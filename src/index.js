import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { connectDB } from "./lib/db.js";
import { createAdmin } from "./controllers/auth.controller.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import doctorRoutes from "./routes/doctor.route.js";
import appointmentRoutes from "./routes/appointment.route.js";
import adminRoutes from "./routes/admin.route.js";
import dashboardRoutes from "./routes/dashboard.route.js";
import reviewRoutes from "./routes/review.route.js";
import notificationRoutes from "./routes/notification.route.js";
import assistantRoutes from "./routes/assistant.route.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";
import { startAppointmentReminders } from "./lib/reminders.js";
import { app, server } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT || 7500;
const allowedOrigins = (process.env.NODE_ENV === "production" ? process.env.CLIENT_URL : "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

// disable cross-origin-resource-policy: the API serves images (Cloudinary
// URLs are returned as JSON, not proxied) and the frontend is a separate
// deployment (Vercel) — the default policy would block cross-origin fetches.
app.use(helmet({ crossOriginResourcePolicy: false }));

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman or mobile apps)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Blanket ceiling on top of the tighter per-route limiters (auth, AI
// assistant) — keeps a single client from hammering any endpoint.
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Increase payload limit and handle JSON/URL-encoded bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/assistant", assistantRoutes);

// API 404 for anything under /api that no route matched.
app.use("/api", notFound);
app.use("/api", errorHandler);

// The frontend is a separate deployment (Vercel) — this backend only ever
// serves the API and Socket.io, so a friendly root response is enough for
// health checks and anyone who visits the bare host directly.
app.get("/", (req, res) => res.json({ status: "ok", service: "connectMedic-backend" }));

const startServer = async () => {
  try {
    await connectDB();
    await createAdmin();

    server.listen(PORT, () => {
      console.log(`Server is running on PORT: ${PORT}`);
      startAppointmentReminders();
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();