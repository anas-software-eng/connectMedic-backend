import User from "../models/user.model.js";
import Doctor from "../models/Doctors.js";
import Appointment from "../models/Appointment.js";
import { toAppointmentView } from "../lib/views.js";
import {
  todayStr,
  isValidDate,
  findAvailability,
  timeInRange,
} from "../lib/slots.js";

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

export const bookAppointment = async (req, res) => {
  try {
    if (req.user.role !== "patient") {
      return res.status(403).json({ message: "Only patients can book appointments" });
    }

    const { doctorId, date, time, reason } = req.body;

    if (!doctorId || !isValidDate(date) || !time) {
      return res.status(400).json({ message: "doctorId, date and time are required" });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.isVerified || !doctor.isAvailable) {
      return res.status(404).json({ message: "Doctor is not available for booking" });
    }

    const range = findAvailability(doctor.availability, date);
    if (!range) {
      return res.status(400).json({ message: "Doctor is not available on this date" });
    }

    if (date < todayStr()) {
      return res.status(400).json({ message: "Cannot book in the past" });
    }

    if (!onGrid(time) || !timeInRange(time, range.startTime, range.endTime)) {
      return res
        .status(400)
        .json({ message: "Selected time is outside the doctor's working hours" });
    }

    const live = (base) =>
      Appointment.findOne({ ...base, status: { $in: ["pending", "confirmed"] } });

    // Backstop the DB unique-index: fail fast with a friendly message.
    if (await live({ doctorId: doctor._id, date, time })) {
      return res.status(409).json({ message: "This time slot was just booked. Pick another." });
    }
    if (await live({ patientId: req.user._id, date, time })) {
      return res.status(409).json({ message: "You already have an appointment at this time" });
    }

    const appointment = await Appointment.create({
      doctorId: doctor._id,
      patientId: req.user._id,
      date,
      time,
      reason: String(reason || "").trim(),
      status: "pending",
    });

    const full = await populate(Appointment.findById(appointment._id));
    res.status(201).json(toAppointmentView(full));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This time slot is no longer available" });
    }
    console.log("Error in bookAppointment:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyAppointments = async (req, res) => {
  try {
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
    res.json(rows.map(toAppointmentView));
  } catch (error) {
    console.log("Error in getMyAppointments:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const getDoctorPatients = async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ message: "Doctor access required" });
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
  } catch (error) {
    console.log("Error in getDoctorPatients:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    const doctor = await Doctor.findById(appointment.doctorId);
    const isDoctor = String(doctor?.userId) === String(req.user._id);
    const isPatient = String(appointment.patientId) === String(req.user._id);

    if (!isDoctor && !isPatient) {
      return res.status(403).json({ message: "Not allowed to cancel this appointment" });
    }
    if (!["pending", "confirmed"].includes(appointment.status)) {
      return res.status(400).json({ message: "Only pending or confirmed appointments can be cancelled" });
    }

    appointment.status = "cancelled";
    await appointment.save();
    res.json({ _id: appointment._id, status: appointment.status });
  } catch (error) {
    console.log("Error in cancelAppointment:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateAppointmentStatus = async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ message: "Doctor access required" });
    }

    const { status } = req.body;
    if (!["confirmed", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid target status" });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (String(doctor?._id) !== String(appointment.doctorId)) {
      return res.status(403).json({ message: "Not your appointment" });
    }
    if (["completed", "cancelled"].includes(appointment.status)) {
      return res.status(400).json({ message: "This appointment is already closed" });
    }

    appointment.status = status;
    await appointment.save();
    res.json({ _id: appointment._id, status: appointment.status });
  } catch (error) {
    console.log("Error in updateAppointmentStatus:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};