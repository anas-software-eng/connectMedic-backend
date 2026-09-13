import express from "express";
import { protectRoute, doctorOnly } from "../middleware/auth.middleware.js";
import {
  bookAppointment,
  getMyAppointments,
  getDoctorPatients,
  cancelAppointment,
  updateAppointmentStatus,
} from "../controllers/appointment.controller.js";

const router = express.Router();

router.get("/patients", protectRoute, doctorOnly, getDoctorPatients);
router.get("/", protectRoute, getMyAppointments);
router.post("/", protectRoute, bookAppointment);
router.put("/:id/cancel", protectRoute, cancelAppointment);
router.put("/:id/status", protectRoute, doctorOnly, updateAppointmentStatus);

export default router;