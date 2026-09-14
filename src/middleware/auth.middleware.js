import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No Token Provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    if (user.isBanned) {
      res.cookie("jwt", "", { maxAge: 0 });
      return res.status(403).json({ message: "Your account has been suspended" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log("Error in protectRoute middleware: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const doctorOnly = (req, res, next) => {
  if (req.user?.role !== "doctor") {
    return res.status(403).json({ message: "Forbidden - Doctors only" });
  }
  next();
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden - Admins only" });
  }
  next();
};
