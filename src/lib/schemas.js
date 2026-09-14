import { z } from "zod";

// Shared request-body schemas for the routes exposed to the least trusted
// input (auth, booking, messaging) — paired with middleware/validate.js.

export const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
  role: z.enum(["patient", "doctor"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const bookAppointmentSchema = z.object({
  doctorId: z.string().trim().min(1, "doctorId is required"),
  date: z.string().trim().min(1, "date is required"),
  time: z.string().trim().min(1, "time is required"),
  reason: z.string().trim().max(500).optional().default(""),
});

export const sendMessageSchema = z
  .object({
    text: z.string().max(4000, "Message is too long").optional().default(""),
    // The client sends `image: null` (not just omits the key) when there's
    // no attachment — accept both, not just a real string or "missing".
    image: z.string().nullish(),
  })
  .refine((d) => d.text.trim() || d.image, {
    message: "Message needs text or an image",
  });
