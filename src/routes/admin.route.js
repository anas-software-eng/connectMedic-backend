import express from "express";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import {
  adminGetUsers,
  adminUpdateUserRole,
  adminSetUserBanned,
  adminGetDoctors,
  adminVerifyDoctor,
  adminUpdateDoctor,
  adminDeleteDoctor,
  adminGetAppointments,
  adminCancelAppointment,
  adminDeleteReview,
  adminBroadcast,
  adminGetAuditLog,
  adminGetConversation,
} from "../controllers/admin.controller.js";

const router = express.Router();

router.use(protectRoute, adminOnly);

router.get("/users", adminGetUsers);
router.put("/users/:id/role", adminUpdateUserRole);
router.put("/users/:id/ban", adminSetUserBanned);

router.get("/doctors", adminGetDoctors);
router.put("/doctors/:id/verify", adminVerifyDoctor);
router.put("/doctors/:id", adminUpdateDoctor);
router.delete("/doctors/:id", adminDeleteDoctor);

router.get("/appointments", adminGetAppointments);
router.put("/appointments/:id/cancel", adminCancelAppointment);

router.delete("/reviews/:id", adminDeleteReview);

router.get("/messages/:userAId/:userBId", adminGetConversation);

router.post("/announce", adminBroadcast);

router.get("/audit", adminGetAuditLog);

export default router;
