// Time-slot helpers shared by the doctor directory and booking logic.
// Appointments live on a fixed 30-minute grid so slot conflicts stay trivial.

export const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
export const SLOT_MINUTES = 30;

const toMinutes = (time) => {
  const [h, m] = String(time).split(":").map(Number);
  return h * 60 + (m || 0);
};

const toTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`;

// "2026-09-12" -> "saturday"
export const weekdayOf = (dateStr) =>
  DAYS[new Date(`${dateStr}T00:00:00`).getDay()];

export const isValidDate = (dateStr) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  return !Number.isNaN(d.getTime());
};

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

// Weekly availability entry that covers the given date, if any.
export const findAvailability = (availability, dateStr) =>
  (availability || []).find((a) => a.day === weekdayOf(dateStr));

// True when a time lands on the grid inside [startTime, endTime).
export const timeInRange = (time, startTime, endTime) => {
  const t = toMinutes(time);
  return t >= toMinutes(startTime) && t + SLOT_MINUTES <= toMinutes(endTime);
};

// All free 30-minute starts for one availability range, minus booked times.
export const generateSlots = (range, booked = []) => {
  const bookedSet = new Set(booked);
  const slots = [];
  const start = toMinutes(range.startTime);
  const end = toMinutes(range.endTime);
  for (let t = start; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) {
    const time = toTime(t);
    if (!bookedSet.has(time)) slots.push(time);
  }
  return slots;
};

// True when endTime is strictly after startTime (so a slot list can be built).
export const isValidAvailability = (startTime, endTime) =>
  toMinutes(endTime) - toMinutes(startTime) >= SLOT_MINUTES;