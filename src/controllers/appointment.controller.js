import User from "../models/user.model.js";
import Doctor from "../models/Doctors.js";
import Appointment from "../models/Appointment.js";
import Review from "../models/Review.js";
import { toAppointmentView } from "../lib/views.js";
import {
  todayStr,
  isValidDate,
  findAvailability,
  timeInRange,
} from "../lib/slots.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/AppError.js";
import { notify } from "../lib/notify.js";

const STATUSES = ["pending", "confirmed", "completed", "cancelled"];

const populate = (query) =>
  query
    .populate("patientId", "fullName profilePic")
    .populate({
      path: "doctorId",
      select: "userId specialization consultationFee profilePic",
      populate: { path: "userId", select: "fullName profilePic" },
    });

const onGrid = (time) => {
  const [, m] = String(time).split(":").map(Number);
  return m % 30 === 0;
};

export const bookAppointment = asyncHandler(async (req, res) => {
  if (req.user.role !== "patient") {
    throw new AppError(403, "Only patients can book appointments");
  }

  const { doctorId, date, time, reason } = req.body;

  if (!doctorId || !isValidDate(date) || !time) {
    throw new AppError(400, "doctorId, date and time are required");
  }

  const doctor = await Doctor.findById(doctorId).populate("userId", "isBanned");
  if (!doctor || !doctor.isVerified || !doctor.isAvailable || doctor.userId?.isBanned) {
    throw new AppError(404, "Doctor is not available for booking");
  }

  const range = findAvailability(doctor.availability, date);
  if (!range) throw new AppError(400, "Doctor is not available on this date");

  if (date < todayStr()) throw new AppError(400, "Cannot book in the past");

  if (!onGrid(time) || !timeInRange(time, range.startTime, range.endTime)) {
    throw new AppError(400, "Selected time is outside the doctor's working hours");
  }

  const live = (base) =>
    Appointment.findOne({ ...base, status: { $in: ["pending", "confirmed"] } });

  // Backstop the DB unique-index: fail fast with a friendly message.
  if (await live({ doctorId: doctor._id, date, time })) {
    throw new AppError(409, "This time slot was just booked. Pick another.");
  }
  if (await live({ patientId: req.user._id, date, time })) {
    throw new AppError(409, "You already have an appointment at this time");
  }

  let appointment;
  try {
    appointment = await Appointment.create({
      doctorId: doctor._id,
      patientId: req.user._id,
      date,
      time,
      reason: String(reason || "").trim(),
      status: "pending",
    });
  } catch (error) {
    if (error?.code === 11000) throw new AppError(409, "This time slot is no longer available");
    throw error;
  }

  await notify(doctor.userId._id, {
    type: "appointment_booked",
    title: "New appointment request",
    body: `${req.user.fullName} requested ${date} at ${time}`,
    link: "/dashboard/appointments",
  });

  const full = await populate(Appointment.findById(appointment._id));
  res.status(201).json(toAppointmentView(full));
});

export const getMyAppointments = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};

  if (status && STATUSES.includes(status)) filter.status = status;

  if (req.user.role === "doctor") {
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) return res.json([]);
    filter.doctorId = doctor._id;
  } else {
    filter.patientId = req.user._id;
  }

  const rows = await populate(
    Appointment.find(filter).sort({ date: -1, time: -1 }).limit(200)
  );

  const views = rows.map(toAppointmentView);

  if (req.user.role === "patient") {
    const reviewed = await Review.distinct("appointmentId", {
      patientId: req.user._id,
      appointmentId: { $in: rows.map((r) => r._id) },
    });
    const reviewedSet = new Set(reviewed.map(String));
    for (const v of views) {
      v.canReview = v.status === "completed" && !reviewedSet.has(String(v._id));
    }
  }

  res.json(views);
});

export const getDoctorPatients = asyncHandler(async (req, res) => {
  if (req.user.role !== "doctor") {
    throw new AppError(403, "Doctor access required");
  }

  const doctor = await Doctor.findOne({ userId: req.user._id });
  if (!doctor) return res.json([]);

  const rows = await Appointment.aggregate([
    {
      $match: {
        doctorId: doctor._id,
        status: { $ne: "cancelled" },
      },
    },
    {
      $group: {
        _id: "$patientId",
        total: { $sum: 1 },
        lastDate: { $max: "$date" },
      },
    },
    { $sort: { lastDate: -1 } },
  ]);

  const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select(
    "fullName profilePic email"
  );
  const byId = new Map(users.map((u) => [String(u._id), u]));

  res.json(
    rows.map((r) => ({
      _id: r._id,
      fullName: byId.get(String(r._id))?.fullName || "Patient",
      profilePic: byId.get(String(r._id))?.profilePic || "",
      total: r.total,
      lastDate: r.lastDate,
    }))
  );
});

export const cancelAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new AppError(404, "Appointment not found");

  const doctor = await Doctor.findById(appointment.doctorId);
  const isDoctor = String(doctor?.userId) === String(req.user._id);
  const isPatient = String(appointment.patientId) === String(req.user._id);

  if (!isDoctor && !isPatient) {
    throw new AppError(403, "Not allowed to cancel this appointment");
  }
  if (!["pending", "confirmed"].includes(appointment.status)) {
    throw new AppError(400, "Only pending or confirmed appointments can be cancelled");
  }

  appointment.status = "cancelled";
  await appointment.save();

  const patient = await User.findById(appointment.patientId).select("fullName");
  const recipientId = isDoctor ? appointment.patientId : doctor?.userId;
  const canceller = isDoctor ? "the doctor" : patient?.fullName || "the patient";
  if (recipientId) {
    await notify(recipientId, {
      type: "appointment_cancelled",
      title: "Appointment cancelled",
      body: `Your ${appointment.date} ${appointment.time} appointment was cancelled by ${canceller}`,
      link: "/dashboard/appointments",
    });
  }

  res.json({ _id: appointment._id, status: appointment.status });
});

export const updateAppointmentStatus = asyncHandler(async (req, res) => {
  if (req.user.role !== "doctor") {
    throw new AppError(403, "Doctor access required");
  }

  // "completed" isn't a unilateral doctor action anymore — see
  // confirmAppointmentCompletion, which needs both sides to agree.
  const { status } = req.body;
  if (!["confirmed", "cancelled"].includes(status)) {
    throw new AppError(400, "Invalid target status");
  }

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new AppError(404, "Appointment not found");

  const doctor = await Doctor.findOne({ userId: req.user._id });
  if (String(doctor?._id) !== String(appointment.doctorId)) {
    throw new AppError(403, "Not your appointment");
  }
  if (["completed", "cancelled"].includes(appointment.status)) {
    throw new AppError(400, "This appointment is already closed");
  }

  appointment.status = status;
  await appointment.save();

  const notifByStatus = {
    confirmed: {
      type: "appointment_confirmed",
      title: "Appointment confirmed",
      body: `Dr. ${req.user.fullName} confirmed your ${appointment.date} ${appointment.time} appointment`,
    },
    cancelled: {
      type: "appointment_cancelled",
      title: "Appointment cancelled",
      body: `Dr. ${req.user.fullName} cancelled your ${appointment.date} ${appointment.time} appointment`,
    },
  };
  const payload = notifByStatus[status];
  if (payload) {
    await notify(appointment.patientId, { ...payload, link: "/dashboard/appointments" });
  }

  res.json({ _id: appointment._id, status: appointment.status });
});

// Completion needs both the doctor and the patient to confirm the visit
// actually happened — either side can answer in either order, and the
// status only flips to "completed" once both have said yes.
export const confirmAppointmentCompletion = asyncHandler(async (req, res) => {
  const { completed } = req.body;
  if (typeof completed !== "boolean") {
    throw new AppError(400, "completed (true/false) is required");
  }

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new AppError(404, "Appointment not found");
  if (appointment.status !== "confirmed") {
    throw new AppError(400, "Only confirmed appointments can be marked done");
  }

  const doctor = await Doctor.findById(appointment.doctorId).select("userId");
  const isDoctor = String(doctor?.userId) === String(req.user._id);
  const isPatient = String(appointment.patientId) === String(req.user._id);
  if (!isDoctor && !isPatient) throw new AppError(403, "Not your appointment");

  if (isDoctor) appointment.doctorConfirmedDone = completed;
  else appointment.patientConfirmedDone = completed;

  const bothConfirmed =
    appointment.doctorConfirmedDone === true && appointment.patientConfirmedDone === true;
  if (bothConfirmed) appointment.status = "completed";

  await appointment.save();

  if (bothConfirmed) {
    await notify(appointment.patientId, {
      type: "appointment_completed",
      title: "Appointment completed",
      body: "How did it go? Leave a review for your doctor.",
      link: "/dashboard/appointments",
    });
    if (doctor) {
      await notify(doctor.userId, {
        type: "appointment_completed",
        title: "Appointment completed",
        body: `Your ${appointment.date} ${appointment.time} visit is confirmed complete by both sides.`,
        link: "/dashboard/appointments",
      });
    }
  }

  const full = await populate(Appointment.findById(appointment._id));
  res.json(toAppointmentView(full));
});
