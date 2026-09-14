import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/", protectRoute, getNotifications);
router.put("/read-all", protectRoute, markAllNotificationsRead);
router.put("/:id/read", protectRoute, markNotificationRead);

export default router;
