import { generateToken, withDoctorProfile } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary, { isCloudinaryConfigured } from "../lib/cloudinary.js";

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

export const signup = async (req, res) => {
  const { fullName, email, password, role } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });

    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      // Only patient/doctor may be self-selected at signup; admin is granted manually.
      role: role === "doctor" ? "doctor" : "patient",
    });

    if (newUser) {
      // generate jwt token here
      generateToken(newUser._id, res);
      await newUser.save();

      res.status(201).json(await withDoctorProfile(newUser));
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json(await withDoctorProfile(user));
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user._id;

    if (!profilePic) {
      return res.status(400).json({ message: "Profile pic is required" });
    }
    if (!isCloudinaryConfigured) {
      return res
        .status(400)
        .json({ message: "Image uploads are not configured on this server" });
    }

    const uploadResponse = await cloudinary.uploader.upload(profilePic, {
      // Uncomment the line below and create an unsigned upload preset in Cloudinary
      // if your API key doesn't have upload permissions
      // upload_preset: "connectmedic-unsigned",
    });
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadResponse.secure_url },
      { new: true }
    );

    res.status(200).json(await withDoctorProfile(updatedUser));
  } catch (error) {
    // Cloudinary rejects with a plain object, not an Error, so `${error}` prints
    // [object Object]. Most Cloudinary failures carry the real reason in
    // error.error.message. The exception is UnexpectedResponse (e.g. the 403 for
    // an API key lacking the "create" action), where the SDK drops the response
    // body and only the generic "unexpected status code" survives.
    const cloudinaryDetail = error?.error?.message;
    console.log(
      "error in updating profile pic ---",
      cloudinaryDetail || error?.message || error
    );
    if (error?.http_code) {
      return res
        .status(502)
        .json({
          message: `Image upload failed: ${cloudinaryDetail || error.message}`,
        });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = async (req, res) => {
  try {
    res.status(200).json(await withDoctorProfile(req.user));
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
