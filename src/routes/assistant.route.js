import express from "express";
import rateLimit from "express-rate-limit";
import { protectRoute } from "../middleware/auth.middleware.js";
import { chatWithAssistant } from "../controllers/assistant.controller.js";

const router = express.Router();

// Each call hits a paid LLM API — cap it independently of the global limiter.
const assistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many AI assistant requests. Please try again shortly." },
});

router.post("/chat", protectRoute, assistantLimiter, chatWithAssistant);

export default router;
