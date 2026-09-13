import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    time: {
      type: String, // HH:mm on the 30-minute grid
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Only live bookings occupy a slot — cancelled ones free it up again.
appointmentSchema.index(
  { doctorId: 1, date: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "confirmed"] } },
  }
);

// Quick lookups for a single patient's calendar.
appointmentSchema.index({ patientId: 1, date: 1, time: 1 });

const Appointment = mongoose.model("Appointment", appointmentSchema);

export default Appointment;