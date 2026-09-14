import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getConversations, getMessages, sendMessage } from "../controllers/message.controller.js";
import { validate } from "../lib/validate.js";
import { sendMessageSchema } from "../lib/schemas.js";

const router = express.Router();

router.get("/conversations", protectRoute, getConversations);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, validate(sendMessageSchema), sendMessage);

export default router;
