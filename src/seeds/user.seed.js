import { config } from "dotenv";
import { connectDB } from "../lib/db.js";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import Doctor from "../models/Doctors.js";

config();

const seedUsers = [
  // Female Users
  {
    email: "emma.thompson@example.com",
    fullName: "Emma Thompson",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/1.jpg",
  },
  {
    email: "olivia.miller@example.com",
    fullName: "Olivia Miller",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/2.jpg",
  },
  {
    email: "sophia.davis@example.com",
    fullName: "Sophia Davis",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/3.jpg",
  },
  {
    email: "ava.wilson@example.com",
    fullName: "Ava Wilson",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/4.jpg",
  },
  {
    email: "isabella.brown@example.com",
    fullName: "Isabella Brown",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/5.jpg",
  },
  {
    email: "mia.johnson@example.com",
    fullName: "Mia Johnson",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/6.jpg",
  },
  {
    email: "charlotte.williams@example.com",
    fullName: "Charlotte Williams",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/7.jpg",
  },
  {
    email: "amelia.garcia@example.com",
    fullName: "Amelia Garcia",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/8.jpg",
  },

  // Male Users
  {
    email: "james.anderson@example.com",
    fullName: "James Anderson",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
  },
  {
    email: "william.clark@example.com",
    fullName: "William Clark",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/2.jpg",
  },
  {
    email: "benjamin.taylor@example.com",
    fullName: "Benjamin Taylor",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/3.jpg",
  },
  {
    email: "lucas.moore@example.com",
    fullName: "Lucas Moore",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/4.jpg",
  },
  {
    email: "henry.jackson@example.com",
    fullName: "Henry Jackson",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
  },
  {
    email: "alexander.martin@example.com",
    fullName: "Alexander Martin",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/6.jpg",
  },
  {
    email: "daniel.rodriguez@example.com",
    fullName: "Daniel Rodriguez",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/7.jpg",
  },
];

// Which seeded users become doctors, and what their profile looks like.
const seedDoctors = [
  {
    email: "emma.thompson@example.com",
    specialization: "Cardiologist",
    qualifications: ["MBBS", "MD Cardiology"],
    licenseNumber: "LIC-1001",
    experienceYears: 12,
    consultationFee: 150,
    clinicAddress: "22 Heart Lane, Springfield",
    about: "Preventive cardiology and post-surgery follow-ups.",
    languages: ["English", "French"],
    isVerified: true,
  },
  {
    email: "james.anderson@example.com",
    specialization: "Dermatologist",
    qualifications: ["MBBS", "MD Dermatology"],
    licenseNumber: "LIC-1002",
    experienceYears: 8,
    consultationFee: 100,
    clinicAddress: "5 Skin & Laser Center, Riverton",
    about: "Medical and cosmetic dermatology for all skin types.",
    languages: ["English"],
    isVerified: true,
  },
  {
    email: "sophia.davis@example.com",
    specialization: "Pediatrician",
    qualifications: ["MBBS", "MD Pediatrics"],
    licenseNumber: "LIC-1003",
    experienceYears: 10,
    consultationFee: 120,
    clinicAddress: "12 Children's Way, Greenfield",
    about: "Newborn care, vaccinations, and child growth monitoring.",
    languages: ["English", "Spanish"],
    isVerified: false, // left pending so the admin flow has something to approve
  },
  {
    email: "lucas.moore@example.com",
    specialization: "Neurologist",
    qualifications: ["MBBS", "MD Neurology"],
    licenseNumber: "LIC-1004",
    experienceYears: 15,
    consultationFee: 180,
    clinicAddress: "8 Brain & Spine Center, Hillcrest",
    about: "Headaches, epilepsy, and movement disorders.",
    languages: ["English", "German"],
    isVerified: true,
  },
];

const WORKING_WEEK = [
  { day: "monday", startTime: "09:00", endTime: "17:00" },
  { day: "tuesday", startTime: "09:00", endTime: "17:00" },
  { day: "wednesday", startTime: "09:00", endTime: "17:00" },
  { day: "thursday", startTime: "09:00", endTime: "17:00" },
  { day: "friday", startTime: "09:00", endTime: "14:00" },
];

const seedDatabase = async () => {
  try {
    await connectDB();

    // Upsert by email so the seed can be re-run safely and passwords stay known.
    const created = [];
    const salt = await bcrypt.genSalt(10);

    for (const seed of seedUsers) {
      const hashed = await bcrypt.hash(seed.password, salt);
      const user = await User.findOneAndUpdate(
        { email: seed.email },
        { ...seed, password: hashed },
        { new: true, upsert: true }
      );
      created.push(user);
    }

    for (const seed of seedDoctors) {
      const user = created.find((u) => u.email === seed.email);
      if (!user) continue;

      // A doctor profile implies a doctor account.
      if (user.role !== "doctor") {
        user.role = "doctor";
        await user.save();
      }

      const existing = await Doctor.findOne({ userId: user._id });
      if (!existing) {
        await Doctor.create({
          userId: user._id,
          availability: WORKING_WEEK,
          ...seed,
        });
      }
    }

    console.log("Database seeded successfully");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

// Call the function
seedDatabase();
