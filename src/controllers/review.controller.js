import Review from "../models/Review.js";
import Doctor from "../models/Doctors.js";
import Appointment from "../models/Appointment.js";
import { AppError } from "../lib/AppError.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { notify } from "../lib/notify.js";

// Recomputes the doctor's aggregate rating from every review on file —
// simplest correct approach at this scale; revisit with an incremental
// running average if the review volume ever makes this expensive.
export const recomputeDoctorRating = async (doctorId) => {
  const [agg] = await Review.aggregate([
    { $match: { doctorId } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Doctor.findByIdAndUpdate(doctorId, {
    rating: agg ? Math.round(agg.avg * 10) / 10 : 0,
    reviewCount: agg?.count || 0,
  });
};

export const createReview = asyncHandler(async (req, res) => {
  if (req.user.role !== "patient") {
    throw new AppError(403, "Only patients can leave reviews");
  }

  const { appointmentId, rating, comment } = req.body;
  const ratingNum = Number(rating);
  if (!appointmentId || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw new AppError(400, "appointmentId and a rating from 1-5 are required");
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment || String(appointment.patientId) !== String(req.user._id)) {
    throw new AppError(404, "Appointment not found");
  }
  if (appointment.status !== "completed") {
    throw new AppError(400, "Only completed appointments can be reviewed");
  }

  const review = await Review.create({
    appointmentId,
    doctorId: appointment.doctorId,
    patientId: req.user._id,
    rating: ratingNum,
    comment: String(comment || "").trim(),
  });

  await recomputeDoctorRating(appointment.doctorId);

  const doctor = await Doctor.findById(appointment.doctorId).select("userId");
  if (doctor) {
    await notify(doctor.userId, {
      type: "review_received",
      title: "New review received",
      body: `${req.user.fullName} left you a ${ratingNum}-star review`,
      link: "/dashboard",
    });
  }

  res.status(201).json(review);
});

export const getDoctorReviews = asyncHandler(async (req, res) => {
  const { doctorId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const filter = { doctorId };
  if (req.query.before) filter._id = { $lt: req.query.before };

  const page = await Review.find(filter)
    .sort({ _id: -1 })
    .limit(limit)
    .populate("patientId", "fullName profilePic")
    .lean();

  res.json({
    reviews: page.map((r) => ({
      _id: r._id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      patientName: r.patientId?.fullName || "Patient",
      patientProfilePic: r.patientId?.profilePic || "",
    })),
    hasMore: page.length === limit,
  });
});
