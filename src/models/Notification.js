import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "appointment_booked",
        "appointment_confirmed",
        "appointment_cancelled",
        "appointment_completed",
        "appointment_reminder",
        "new_message",
        "doctor_verified",
        "review_received",
        "announcement",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      default: "",
    },
    // Frontend route to send the user to when they click the notification.
    link: {
      type: String,
      default: "",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
