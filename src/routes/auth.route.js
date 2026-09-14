import express from "express";
import rateLimit from "express-rate-limit";
import { checkAuth, login, logout, signup, updateProfile } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../lib/validate.js";
import { signupSchema, loginSchema } from "../lib/schemas.js";

const router = express.Router();

// Credential-guessing protection — tighter than the app-wide limiter.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

router.post("/signup", authLimiter, validate(signupSchema), signup);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);

router.get("/check", protectRoute, checkAuth);

export default router;
