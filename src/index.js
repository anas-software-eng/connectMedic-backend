import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./lib/db.js";
import { createAdmin } from "./controllers/auth.controller.js";
import authRoutes from "./routes/auth.route.js";
import docRoutes from "./routes/doctorProfile.js";
import messageRoutes from "./routes/message.route.js";
import doctorRoutes from "./routes/doctor.route.js";
import appointmentRoutes from "./routes/appointment.route.js";
import adminRoutes from "./routes/admin.route.js";
import dashboardRoutes from "./routes/dashboard.route.js";
import { app, server } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT || 7500;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173").split(",");

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Increase payload limit and handle JSON/URL-encoded bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api", docRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);

// API 404 for anything under /api that no route matched.
app.use("/api", (req, res) => res.status(404).json({ message: "Route not found" }));

if (process.env.NODE_ENV === "production") {
  // Backend lives in backend/src; the built site lives in ../frontend/dist.
  const frontendDist = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(frontendDist));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

const startServer = async () => {
  try {
    await connectDB();
    await createAdmin();

    server.listen(PORT, () => {
      console.log(`Server is running on PORT: ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();