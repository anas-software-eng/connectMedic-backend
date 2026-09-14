import express from "express";
import { protectRoute, doctorOnly } from "../middleware/auth.middleware.js";
import {
  bookAppointment,
  getMyAppointments,
  getDoctorPatients,
  cancelAppointment,
  updateAppointmentStatus,
  confirmAppointmentCompletion,
} from "../controllers/appointment.controller.js";
import { validate } from "../lib/validate.js";
import { bookAppointmentSchema } from "../lib/schemas.js";

const router = express.Router();

router.get("/patients", protectRoute, doctorOnly, getDoctorPatients);
router.get("/", protectRoute, getMyAppointments);
router.post("/", protectRoute, validate(bookAppointmentSchema), bookAppointment);
router.put("/:id/cancel", protectRoute, cancelAppointment);
router.put("/:id/status", protectRoute, doctorOnly, updateAppointmentStatus);
router.put("/:id/confirm-completion", protectRoute, confirmAppointmentCompletion);

export default router;