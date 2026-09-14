import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";

import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/AppError.js";
import { matchSpecializations } from "../lib/conditions.js";

// Same "is this integration configured" pattern as lib/cloudinary.js —
// missing credentials degrade to a clear 503 instead of a stack trace.
// Groq Cloud exposes an OpenAI-compatible endpoint, so the OpenAI SDK works
// unchanged — just point it at Groq's base URL with a Groq key.
const isAssistantConfigured = Boolean(process.env.GROQ_API_KEY);
const client = isAssistantConfigured
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" })
  : null;
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You are the ConnectMedic AI Health Assistant, embedded in a telemedicine app that connects patients with doctors.

Your job is brief, friendly symptom triage:
- Ask short clarifying questions when the patient's symptoms are vague.
- Once you have enough to go on, suggest which kind of doctor they should book, choosing only from: General Physician, Cardiologist, Dermatologist, Neurologist, Orthopedic Surgeon, Pediatrician, Gynecologist, Psychiatrist, ENT Specialist, Ophthalmologist.
- You are not a doctor. Never give a diagnosis, a prescription, or a dosage. End triage replies with a brief reminder that this is not medical advice.
- If the patient describes possible emergency symptoms (e.g. chest pain with shortness of breath, severe bleeding, stroke signs, suicidal thoughts), tell them plainly to seek emergency care immediately (call local emergency services or go to the nearest ER) instead of continuing the triage conversation.
- Keep replies short: 2-5 sentences, warm and plain-language, no long lists unless the patient asks for one.`;

const MAX_HISTORY = 20;
const MAX_MESSAGE_LENGTH = 2000;

export const chatWithAssistant = asyncHandler(async (req, res) => {
  if (!isAssistantConfigured) {
    throw new AppError(503, "The AI health assistant is not configured on this server yet");
  }

  const incoming = Array.isArray(req.body.messages) ? req.body.messages : [];
  if (incoming.length === 0) throw new AppError(400, "messages is required");

  const messages = incoming.slice(-MAX_HISTORY).map((m) => {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      throw new AppError(400, "Each message needs role 'user'/'assistant' and string content");
    }
    return { role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) };
  });

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
  });

  const reply = response.choices[0]?.message?.content || "";
  const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  res.json({
    reply,
    // Cross-links the chat to the doctor directory using the same
    // keyword matcher the search bar already uses.
    suggestedSpecializations: matchSpecializations(lastUserText),
  });
});
