
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URL || "mongodb://localhost:27017"
    );
    console.log(`MongoDB connected to the db: ${conn.connection.name}`);
  } catch (error) {
    console.log("MongoDB connection error:", error);
    throw error; // let the server fail fast instead of hanging with no DB
  }
};
