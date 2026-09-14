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
    // Completion needs both sides to agree the visit happened — null means
    // "hasn't answered yet", so it's distinct from an explicit "no".
    doctorConfirmedDone: {
      type: Boolean,
      default: null,
    },
    patientConfirmedDone: {
      type: Boolean,
      default: null,
    },
    // Set once the pre-visit reminder notification has gone out, so the
    // reminder sweep never nags the patient twice for the same visit.
    reminderSentAt: {
      type: Date,
      default: null,
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