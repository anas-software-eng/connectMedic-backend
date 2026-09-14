import mongoose from "mongoose";

import User from "../models/user.model.js";
import Doctor from "../models/Doctors.js";
import Appointment from "../models/Appointment.js";
import Review from "../models/Review.js";
import Message from "../models/message.model.js";
import AuditLog from "../models/AuditLog.js";
import { toAppointmentView } from "../lib/views.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/AppError.js";
import { notify } from "../lib/notify.js";
import { logAdminAction } from "../lib/audit.js";
import { recomputeDoctorRating } from "./review.controller.js";

const ROLES = ["patient", "doctor", "admin"];
const APPOINTMENT_STATUSES = ["pending", "confirmed", "completed", "cancelled"];

const populateAppointments = (query) =>
  query
    .populate("patientId", "fullName profilePic email")
    .populate({
      path: "doctorId",
      select: "userId specialization consultationFee",
      populate: { path: "userId", select: "fullName profilePic" },
    });

// ---------- Users ----------

export const adminGetUsers = asyncHandler(async (req, res) => {
  const { role = "" } = req.query;
  const filter = ROLES.includes(role) ? { role } : {};
  const users = await User.find(filter)
    .select("-password")
    .sort({ createdAt: -1 })
    .limit(200);
  res.json(users);
});

export const adminUpdateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!ROLES.includes(role)) throw new AppError(400, "Invalid role");
  if (String(req.params.id) === String(req.user._id)) {
    throw new AppError(400, "You can't change your own role");
  }

  const target = await User.findById(req.params.id);
  if (!target) throw new AppError(404, "User not found");

  if (target.role === "admin" && role !== "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) throw new AppError(400, "Can't demote the last admin");
  }

  const previousRole = target.role;
  target.role = role;
  await target.save();
  await logAdminAction(req.user, "user.role_change", "User", target._id, `${target.email}: ${previousRole} -> ${role}`);

  res.json({ _id: target._id, role: target.role });
});

export const adminSetUserBanned = asyncHandler(async (req, res) => {
  const { banned } = req.body;
  if (typeof banned !== "boolean") throw new AppError(400, "banned (true/false) is required");
  if (String(req.params.id) === String(req.user._id)) {
    throw new AppError(400, "You can't ban yourself");
  }

  const target = await User.findById(req.params.id);
  if (!target) throw new AppError(404, "User not found");

  if (banned && target.role === "admin") {
    const activeAdmins = await User.countDocuments({ role: "admin", isBanned: false });
    if (activeAdmins <= 1) throw new AppError(400, "Can't ban the last active admin");
  }

  target.isBanned = banned;
  await target.save();
  await logAdminAction(req.user, banned ? "user.ban" : "user.unban", "User", target._id, target.email);

  res.json({ _id: target._id, isBanned: target.isBanned });
});

// ---------- Doctors ----------

export const adminGetDoctors = asyncHandler(async (req, res) => {
  const { verified } = req.query;
  const filter = {};
  if (verified === "true") filter.isVerified = true;
  if (verified === "false") filter.isVerified = false;

  const doctors = await Doctor.find(filter)
    .populate("userId", "fullName profilePic email")
    .sort({ createdAt: -1 });
  res.json(doctors);
});

export const adminVerifyDoctor = asyncHandler(async (req, res) => {
  const { isVerified } = req.body;
  const doctor = await Doctor.findByIdAndUpdate(
    req.params.id,
    { isVerified: !!isVerified },
    { new: true }
  );
  if (!doctor) throw new AppError(404, "Doctor not found");

  await logAdminAction(
    req.user,
    doctor.isVerified ? "doctor.verify" : "doctor.unverify",
    "Doctor",
    doctor._id,
    String(doctor.userId)
  );

  if (doctor.isVerified) {
    await notify(doctor.userId, {
      type: "doctor_verified",
      title: "You're verified!",
      body: "Your doctor profile has been verified and is now visible to patients.",
      link: "/profile",
    });
  }

  res.json({ _id: doctor._id, isVerified: doctor.isVerified });
});

export const adminUpdateDoctor = asyncHandler(async (req, res) => {
  const editable = ["specialization", "consultationFee", "isAvailable", "clinicAddress", "about", "experienceYears"];
  const updates = {};
  for (const key of editable) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) throw new AppError(400, "No editable fields provided");

  const doctor = await Doctor.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
  if (!doctor) throw new AppError(404, "Doctor not found");

  await logAdminAction(req.user, "doctor.update", "Doctor", doctor._id, JSON.stringify(updates));
  res.json(doctor);
});

export const adminDeleteDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findByIdAndDelete(req.params.id);
  if (!doctor) throw new AppError(404, "Doctor not found");

  await logAdminAction(req.user, "doctor.delete_profile", "Doctor", req.params.id, `userId ${doctor.userId}`);
  res.json({ ok: true });
});

// ---------- Appointments (platform-wide) ----------

export const adminGetAppointments = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status && APPOINTMENT_STATUSES.includes(status)) filter.status = status;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  if (req.query.before) filter._id = { $lt: req.query.before };

  const rows = await populateAppointments(Appointment.find(filter).sort({ _id: -1 }).limit(limit));
  res.json({ appointments: rows.map(toAppointmentView), hasMore: rows.length === limit });
});

export const adminCancelAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new AppError(404, "Appointment not found");
  if (["completed", "cancelled"].includes(appointment.status)) {
    throw new AppError(400, "This appointment is already closed");
  }

  appointment.status = "cancelled";
  await appointment.save();

  const doctor = await Doctor.findById(appointment.doctorId).select("userId");
  await notify(appointment.patientId, {
    type: "appointment_cancelled",
    title: "Appointment cancelled",
    body: `Your ${appointment.date} ${appointment.time} appointment was cancelled by an administrator`,
    link: "/dashboard/appointments",
  });
  if (doctor) {
    await notify(doctor.userId, {
      type: "appointment_cancelled",
      title: "Appointment cancelled",
      body: `The ${appointment.date} ${appointment.time} appointment was cancelled by an administrator`,
      link: "/dashboard/appointments",
    });
  }

  await logAdminAction(req.user, "appointment.force_cancel", "Appointment", appointment._id, `${appointment.date} ${appointment.time}`);
  res.json({ _id: appointment._id, status: appointment.status });
});

// ---------- Reviews (moderation) ----------

export const adminDeleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) throw new AppError(404, "Review not found");

  await recomputeDoctorRating(review.doctorId);
  await logAdminAction(req.user, "review.delete", "Review", review._id, `doctor ${review.doctorId}`);
  res.json({ ok: true });
});

// ---------- Broadcast ----------

export const adminBroadcast = asyncHandler(async (req, res) => {
  const { title, body, audience } = req.body;
  if (!String(title || "").trim()) throw new AppError(400, "title is required");

  const filter =
    audience === "patients" ? { role: "patient" } : audience === "doctors" ? { role: "doctor" } : { role: { $in: ["patient", "doctor"] } };

  const recipients = await User.find(filter).select("_id");
  await Promise.all(
    recipients.map((u) =>
      notify(u._id, {
        type: "announcement",
        title: String(title).trim(),
        body: String(body || "").trim(),
        link: "/dashboard",
      })
    )
  );

  await logAdminAction(
    req.user,
    "broadcast.send",
    "Notification",
    "",
    `${audience || "all"}: "${title}" -> ${recipients.length} recipients`
  );

  res.json({ ok: true, recipients: recipients.length });
});

// ---------- Message oversight ----------
// Read-only — deliberately does not mark anything as seen, since that would
// tamper with the real conversation's read receipts. Every view is logged:
// reading a private patient-doctor thread is sensitive enough to leave a
// trail of who looked, and when.

export const adminGetConversation = asyncHandler(async (req, res) => {
  const { userAId, userBId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userAId) || !mongoose.Types.ObjectId.isValid(userBId)) {
    throw new AppError(400, "Invalid user id");
  }

  const [userA, userB] = await Promise.all([
    User.findById(userAId).select("fullName profilePic role"),
    User.findById(userBId).select("fullName profilePic role"),
  ]);
  if (!userA || !userB) throw new AppError(404, "User not found");

  const messages = await Message.find({
    $or: [
      { senderId: userAId, receiverId: userBId },
      { senderId: userBId, receiverId: userAId },
    ],
  })
    .sort({ _id: 1 })
    .limit(500)
    .lean();

  await logAdminAction(
    req.user,
    "message.view_thread",
    "Conversation",
    `${userAId}:${userBId}`,
    `${userA.fullName} <-> ${userB.fullName} (${messages.length} messages)`
  );

  res.json({
    userA: { _id: userA._id, fullName: userA.fullName, profilePic: userA.profilePic, role: userA.role },
    userB: { _id: userB._id, fullName: userB.fullName, profilePic: userB.profilePic, role: userB.role },
    messages,
  });
});

// ---------- Audit log ----------

export const adminGetAuditLog = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const filter = {};
  if (req.query.before) filter._id = { $lt: req.query.before };

  const page = await AuditLog.find(filter).sort({ _id: -1 }).limit(limit).lean();
  res.json({ logs: page, hasMore: page.length === limit });
});
