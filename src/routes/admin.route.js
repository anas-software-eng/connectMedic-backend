import express from "express";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import {
  adminGetUsers,
  adminGetDoctors,
  adminVerifyDoctor,
} from "../controllers/admin.controller.js";

const router = express.Router();

router.get("/users", protectRoute, adminOnly, adminGetUsers);
router.get("/doctors", protectRoute, adminOnly, adminGetDoctors);
router.put("/doctors/:id/verify", protectRoute, adminOnly, adminVerifyDoctor);

export default router;