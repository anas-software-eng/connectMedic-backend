import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

import path from "path";

import { connectDB } from "./lib/db.js";
import { createAdmin } from "./controllers/auth.controller.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";
import cloudinary from "./lib/cloudinary.js";

dotenv.config();

const PORT = process.env.PORT || 7500;
const __dirname = path.resolve();

app.use(cors({
  origin: 'http://localhost:5173', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
})); 

// Increase payload limit and handle JSON/URL-encoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

const startServer = async () => {
  try {
    // Validate Cloudinary configuration on startup
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error("Missing Cloudinary environment variables. Please check your .env file.");
    }

    // Test Cloudinary connection
    try {
      await cloudinary.api.ping();
      console.log("✓ Cloudinary connection verified");
    } catch (cloudinaryError) {
      const cloudinaryDetail = cloudinaryError?.error?.message || cloudinaryError.message;
      console.error("✗ Cloudinary connection failed:", cloudinaryDetail);
      console.error("Please verify your Cloudinary credentials in .env file.");
      console.error("Common issues:");
      console.error("  - Invalid API key/secret");
      console.error("  - API key lacks 'create' permission");
      console.error("  - Account restrictions");
      process.exit(1);
    }

    await connectDB();

    await createAdmin();

    server.listen(PORT, () => {
      console.log("Server is running on PORT: " + PORT);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();