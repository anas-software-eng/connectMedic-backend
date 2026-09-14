import Appointment from "../models/Appointment.js";
import { todayStr } from "./slots.js";
import { notify } from "./notify.js";

const REMINDER_WINDOW_MINUTES = 30;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const toMinutes = (time) => {
  const [h, m] = String(time).split(":").map(Number);
  return h * 60 + (m || 0);
};

const sendDueReminders = async () => {
  try {
    const date = todayStr();
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const due = await Appointment.find({ status: "confirmed", date, reminderSentAt: null })
      .populate("patientId", "fullName")
      .populate({
        path: "doctorId",
        select: "userId",
        populate: { path: "userId", select: "fullName" },
      });

    for (const appointment of due) {
      const minutesUntil = toMinutes(appointment.time) - nowMinutes;
      if (minutesUntil < 0 || minutesUntil > REMINDER_WINDOW_MINUTES) continue;
      if (!appointment.patientId) continue;

      const doctorName = appointment.doctorId?.userId?.fullName || "your doctor";
      await notify(appointment.patientId._id, {
        type: "appointment_reminder",
        title: "Upcoming appointment",
        body: `Your visit with Dr. ${doctorName} is at ${appointment.time} today`,
        link: "/dashboard/appointments",
      });

      appointment.reminderSentAt = new Date();
      await appointment.save();
    }
  } catch (error) {
    console.error("Error sending appointment reminders:", error.message);
  }
};

// Simple in-process sweep — fine at this scale; move to a real job queue if
// the backend ever runs as more than one instance.
export const startAppointmentReminders = () => {
  sendDueReminders();
  setInterval(sendDueReminders, CHECK_INTERVAL_MS);
};
