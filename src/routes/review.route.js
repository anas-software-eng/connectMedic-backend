import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createReview, getDoctorReviews } from "../controllers/review.controller.js";

const router = express.Router();

router.get("/:doctorId", getDoctorReviews);
router.post("/", protectRoute, createReview);

export default router;
