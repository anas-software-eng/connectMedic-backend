// Symptom/disease keywords patients type, mapped to the specialization slugs
// used by SPECIALIZATIONS on the frontend ("chest pain" -> cardiologist).
const CONDITIONS = {
  "general-physician": [
    "fever", "flu", "cold", "cough", "viral", "infection", "fatigue",
    "weakness", "checkup",
  ],
  cardiologist: [
    "heart", "cardiac", "chest pain", "blood pressure", "hypertension",
    "palpitation", "cholesterol",
  ],
  dermatologist: [
    "skin", "acne", "rash", "eczema", "psoriasis", "hair loss", "hairfall",
    "fungal", "mole",
  ],
  neurologist: [
    "migraine", "headache", "seizure", "epilepsy", "stroke", "numbness",
    "vertigo", "dizziness", "parkinson",
  ],
  "orthopedic-surgeon": [
    "bone", "joint", "knee", "back pain", "fracture", "arthritis",
    "shoulder", "spine", "sprain",
  ],
  pediatrician: [
    "child", "children", "kid", "baby", "infant", "newborn", "toddler",
    "vaccination",
  ],
  gynecologist: [
    "pregnancy", "periods", "menstrual", "pcos", "pcod", "uterus",
    "ovarian", "prenatal",
  ],
  psychiatrist: [
    "depression", "anxiety", "stress", "mental health", "bipolar",
    "insomnia", "panic",
  ],
  "ent-specialist": [
    "ear", "nose", "throat", "sinus", "tonsil", "hearing", "snoring", "voice",
  ],
  ophthalmologist: [
    "eye", "vision", "cataract", "glaucoma", "retina", "squint",
  ],
};

// "chest pain and skin rash" -> ["cardiologist", "dermatologist"]
export const matchSpecializations = (text) => {
  const q = String(text).toLowerCase();
  if (!q.trim()) return [];
  return Object.keys(CONDITIONS).filter((spec) =>
    CONDITIONS[spec].some((keyword) => q.includes(keyword))
  );
};

// Builds a pattern that matches a specialization however it was stored —
// the slug "general-physician" or the label "General Physician" / "cardiologist".
export const specializationPattern = (value) => {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/-/g, "[\\s-]?")}$`, "i");
};