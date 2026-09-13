import express from "express";
import { protectRoute, doctorOnly } from "../middleware/auth.middleware.js";
import {
  listDoctors,
  getDoctorById,
  getMyDoctorProfile,
  upsertMyDoctorProfile,
  getDoctorSlots,
} from "../controllers/doctor.controller.js";

const router = express.Router();

router.get("/", listDoctors);
router.get("/mine", protectRoute, doctorOnly, getMyDoctorProfile);
router.put("/mine", protectRoute, doctorOnly, upsertMyDoctorProfile);
router.get("/:id/slots", protectRoute, getDoctorSlots);
router.get("/:id", getDoctorById);

export default router;