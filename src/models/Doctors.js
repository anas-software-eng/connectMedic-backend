import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    specialization: {
      type: String,
      required: true,
    },
    qualifications: {
      type: [String],
      default: [],
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    about: {
      type: String,
      default: "",
    },
    languages: {
      type: [String],
      default: [],
    },
    consultationFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    clinicAddress: {
      type: String,
      default: "",
    },
    availability: [
      {
        day: {
          type: String,
          enum: [
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
          ],
          required: true,
        },
        startTime: {
          type: String,
          required: true,
        },
        endTime: {
          type: String,
          required: true,
        },
      },
    ],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

doctorSchema.index({ specialization: 1, isVerified: 1 });

const Doctor = mongoose.model("Doctor", doctorSchema);

export default Doctor;
