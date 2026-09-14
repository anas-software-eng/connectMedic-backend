import { generateToken, withDoctorProfile, clearAuthCookie } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary, { isCloudinaryConfigured } from "../lib/cloudinary.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/AppError.js";

import dotenv from "dotenv";
dotenv.config();

export const createAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.log("ADMIN_EMAIL or ADMIN_PASSWORD is missing");
      return;
    }

    const existingAdmin = await User.findOne({
      email: adminEmail,
    });

    if (existingAdmin) {
      console.log("Admin already exists");
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const admin = await User.create({
      fullName: "Admin",
      email: adminEmail,
      password: hashedPassword,
      role: "admin",
    });

    console.log(`Admin created: ${admin.email}`);
  } catch (error) {
    console.error("Error creating admin:", error.message);
  }
};

export const signup = asyncHandler(async (req, res) => {
  const { fullName, email, password, role } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw new AppError(400, "Email already exists");

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = new User({
    fullName,
    email,
    password: hashedPassword,
    // Only patient/doctor may be self-selected at signup; admin is granted manually.
    role: role === "doctor" ? "doctor" : "patient",
  });

  generateToken(newUser._id, res);
  await newUser.save();

  res.status(201).json(await withDoctorProfile(newUser));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new AppError(400, "Invalid credentials");

  const isPasswordCorrect = await bcrypt.compare(password, user.password);
  if (!isPasswordCorrect) throw new AppError(400, "Invalid credentials");

  if (user.isBanned) throw new AppError(403, "Your account has been suspended");

  generateToken(user._id, res);

  res.status(200).json(await withDoctorProfile(user));
});

export const logout = (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ message: "Logged out successfully" });
};

export const updateProfile = asyncHandler(async (req, res) => {
  const { profilePic } = req.body;
  const userId = req.user._id;

  if (!profilePic) throw new AppError(400, "Profile pic is required");
  if (!isCloudinaryConfigured) {
    throw new AppError(400, "Image uploads are not configured on this server");
  }

  let uploadResponse;
  try {
    uploadResponse = await cloudinary.uploader.upload(profilePic, {
      // Uncomment the line below and create an unsigned upload preset in Cloudinary
      // if your API key doesn't have upload permissions
      // upload_preset: "connectmedic-unsigned",
    });
  } catch (error) {
    // Cloudinary rejects with a plain object, not an Error, so `${error}` prints
    // [object Object]. Most Cloudinary failures carry the real reason in
    // error.error.message. The exception is UnexpectedResponse (e.g. the 403 for
    // an API key lacking the "create" action), where the SDK drops the response
    // body and only the generic "unexpected status code" survives.
    const cloudinaryDetail = error?.error?.message;
    console.log("error in updating profile pic ---", cloudinaryDetail || error?.message || error);
    throw new AppError(502, `Image upload failed: ${cloudinaryDetail || error?.message || "unknown error"}`);
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { profilePic: uploadResponse.secure_url },
    { new: true }
  );

  res.status(200).json(await withDoctorProfile(updatedUser));
});

export const checkAuth = asyncHandler(async (req, res) => {
  res.status(200).json(await withDoctorProfile(req.user));
});
