import express from "express";
import { createDocProfile , getDocProfileOverview } from "../controllers/doctor.js";
import { protectRoute, permission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/doctor/profile-setup", protectRoute, permission, createDocProfile);
router.get("/doctor/profile-overview", protectRoute, permission, getDocProfileOverview);

export default router;
