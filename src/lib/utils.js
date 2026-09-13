import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Doctor from "../models/Doctors.js";

dotenv.config();

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // MS
    httpOnly: true, // prevent XSS attacks cross-site scripting attacks
    sameSite: "strict", // CSRF attacks cross-site request forgery attacks
    // Only send over HTTPS in production; local HTTP dev must not set Secure.
    secure: process.env.NODE_ENV === "production",
  });

  return token;
};

// Doctors keep two records: the auth `User` and a `Doctor` profile.
// This flattens the profile onto the user object the API returns, so the whole
// app can read `user.specialization`, `user.availability`, ... in one place.
export const withDoctorProfile = async (user) => {
  if (!user || user.role !== "doctor") return user;

  const doctor = await Doctor.findOne({ userId: user._id }).lean();
  if (!doctor) return user;

  const { _id, userId, createdAt, updatedAt, __v, ...profile } = doctor;
  return { ...user.toObject(), ...profile, _id: user._id };
};
