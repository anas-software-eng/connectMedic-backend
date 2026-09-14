import User from "../models/user.model.js";
import Doctor from "../models/Doctors.js";
import Appointment from "../models/Appointment.js";
import { withDoctorProfile } from "../lib/utils.js";
import { toDoctorView } from "../lib/views.js";
import { matchSpecializations, specializationPattern } from "../lib/conditions.js";
import {
  DAYS,
  todayStr,
  isValidDate,
  findAvailability,
  generateSlots,
  isValidAvailability,
} from "../lib/slots.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/AppError.js";

const DAY_SET = new Set(DAYS);

// Keep only well-formed rows so half-typed availability can never reach the DB.
const sanitizeAvailability = (list) => {
  const out = [];
  for (const s of Array.isArray(list) ? list : []) {
    if (
      !s ||
      !DAY_SET.has(s.day) ||
      !isValidAvailability(s.startTime, s.endTime)
    )
      continue;
    out.push({ day: s.day, startTime: s.startTime, endTime: s.endTime });
  }
  return out;
};

export const listDoctors = asyncHandler(async (req, res) => {
  const { query = "", specialization = "" } = req.query;
  const filter = { isVerified: true, isAvailable: true };

  // A ban has to actually remove the doctor from the app, not just block
  // their own login — otherwise patients could still find and book them.
  const bannedUserIds = await User.find({ isBanned: true }).select("_id");
  if (bannedUserIds.length) filter.userId = { $nin: bannedUserIds.map((u) => u._id) };

  // Accepts the slug ("ent-specialist") or the label ("ENT Specialist").
  if (specialization) filter.specialization = specializationPattern(specialization);

  const text = String(query).trim();
  if (text) {
    const rx = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const clauses = [
      { specialization: rx },
      { clinicAddress: rx },
      { about: rx },
      { qualifications: rx },
      { languages: rx },
    ];
    // Symptoms like "chest pain" or "skin rash" pull in the matching
    // specializations, so patients find the right doctor without knowing one.
    for (const spec of matchSpecializations(text)) {
      clauses.push({ specialization: specializationPattern(spec) });
    }
    filter.$or = clauses;
  }

  const doctors = await Doctor.find(filter)
    .populate("userId", "fullName profilePic")
    .sort({ rating: -1, reviewCount: -1 })
    .limit(60);

  res.json(doctors.map(toDoctorView));
});

export const getDoctorById = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).populate(
    "userId",
    "fullName profilePic isBanned"
  );
  if (!doctor || doctor.userId?.isBanned) throw new AppError(404, "Doctor not found");
  res.json(toDoctorView(doctor));
});

export const getMyDoctorProfile = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ userId: req.user._id }).populate(
    "userId",
    "fullName profilePic"
  );
  res.json(doctor ? toDoctorView(doctor) : null);
});

export const upsertMyDoctorProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const body = {
    specialization: String(req.body.specialization || "").trim(),
    qualifications: Array.isArray(req.body.qualifications)
      ? req.body.qualifications.map(String)
      : [],
    licenseNumber: String(req.body.licenseNumber || "").trim(),
    experienceYears: Math.max(0, Number(req.body.experienceYears) || 0),
    consultationFee: Math.max(0, Number(req.body.consultationFee) || 0),
    clinicAddress: String(req.body.clinicAddress || "").trim(),
    about: String(req.body.about || "").trim(),
    languages: Array.isArray(req.body.languages)
      ? req.body.languages.map(String)
      : [],
    availability: sanitizeAvailability(req.body.availability),
    isAvailable: req.body.isAvailable !== false,
  };

  if (!body.specialization || !body.licenseNumber) {
    throw new AppError(400, "Specialization and license number are required");
  }

  await Doctor.findOneAndUpdate(
    { userId },
    { $set: body },
    { new: true, upsert: true, runValidators: true }
  );

  // Return the flattened user so the frontend auth state stays in sync.
  const user = await User.findById(userId).select("-password");
  res.json(await withDoctorProfile(user));
});

export const getDoctorSlots = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!isValidDate(date)) throw new AppError(400, "Invalid date");

  const doctor = await Doctor.findById(req.params.id).populate("userId", "isBanned");
  if (!doctor || !doctor.isVerified || !doctor.isAvailable || doctor.userId?.isBanned) {
    throw new AppError(404, "Doctor is not available for booking");
  }

  const range = findAvailability(doctor.availability, date);
  if (!range) return res.json([]);

  const booked = await Appointment.find({
    doctorId: doctor._id,
    date,
    status: { $in: ["pending", "confirmed"] },
  }).select("time");

  let slots = generateSlots(range, booked.map((b) => b.time));

  // Never offer time that has already passed today.
  if (date === todayStr()) {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    slots = slots.filter((t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m > nowMinutes;
    });
  }

  res.json(slots);
});
