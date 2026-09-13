import User from "../models/user.model.js";
import Doctor from "../models/Doctors.js";
import Appointment from "../models/Appointment.js";
import { toAppointmentView } from "../lib/views.js";
import { todayStr } from "../lib/slots.js";

const populateAppointments = (query) =>
  query
    .populate("patientId", "fullName profilePic")
    .populate({
      path: "doctorId",
      select: "userId specialization consultationFee profilePic",
      populate: { path: "userId", select: "fullName profilePic" },
    });

// One endpoint feeds the dashboard home for every role: counts for the stat
// tiles plus recent rows for the list sections.
export const getDashboardStats = async (req, res) => {
  try {
    const me = req.user;

    if (me.role === "admin") {
      const [users, clinicians, unverified] = await Promise.all([
        User.countDocuments(),
        Doctor.countDocuments({ isVerified: true }),
        Doctor.countDocuments({ isVerified: false }),
      ]);
      const signups = await User.find()
        .select("fullName email role createdAt")
        .sort({ createdAt: -1 })
        .limit(5);
      return res.json({ stats: { users, clinicians, unverified }, signups });
    }

    if (me.role === "doctor") {
      const doctor = await Doctor.findOne({ userId: me._id });
      if (!doctor) {
        return res.json({
          stats: { queue: 0, today: 0, patients: 0 },
          appointments: [],
        });
      }
      const [pending, today] = await Promise.all([
        Appointment.countDocuments({ doctorId: doctor._id, status: "pending" }),
        Appointment.countDocuments({
          doctorId: doctor._id,
          status: { $in: ["pending", "confirmed"] },
          date: todayStr(),
        }),
      ]);
      const patientIds = await Appointment.distinct("patientId", {
        doctorId: doctor._id,
        status: { $ne: "cancelled" },
      });
      const rows = await populateAppointments(
        Appointment.find({ doctorId: doctor._id })
          .sort({ date: -1, time: -1 })
          .limit(5)
      );
      return res.json({
        stats: { queue: pending, today, patients: patientIds.length },
        appointments: rows.map(toAppointmentView),
      });
    }

    // patient
    const [upcoming, total] = await Promise.all([
      Appointment.countDocuments({
        patientId: me._id,
        status: { $in: ["pending", "confirmed"] },
        date: { $gte: todayStr() },
      }),
      Appointment.countDocuments({
        patientId: me._id,
        status: { $ne: "cancelled" },
      }),
    ]);
    const rows = await populateAppointments(
      Appointment.find({ patientId: me._id })
        .sort({ date: -1, time: -1 })
        .limit(5)
    );
    res.json({
      stats: { upcoming, total },
      appointments: rows.map(toAppointmentView),
    });
  } catch (error) {
    console.log("Error in getDashboardStats:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};