import User from "../models/user.model.js";
import Doctor from "../models/Doctors.js";

const ROLES = ["patient", "doctor", "admin"];

export const adminGetUsers = async (req, res) => {
  try {
    const { role = "" } = req.query;
    const filter = ROLES.includes(role) ? { role } : {};
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(users);
  } catch (error) {
    console.log("Error in adminGetUsers:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const adminGetDoctors = async (req, res) => {
  try {
    const { verified } = req.query;
    const filter = {};
    if (verified === "true") filter.isVerified = true;
    if (verified === "false") filter.isVerified = false;

    const doctors = await Doctor.find(filter)
      .populate("userId", "fullName profilePic email")
      .sort({ createdAt: -1 });
    res.json(doctors);
  } catch (error) {
    console.log("Error in adminGetDoctors:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const adminVerifyDoctor = async (req, res) => {
  try {
    const { isVerified } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { isVerified: !!isVerified },
      { new: true }
    );
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    res.json({ _id: doctor._id, isVerified: doctor.isVerified });
  } catch (error) {
    console.log("Error in adminVerifyDoctor:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};