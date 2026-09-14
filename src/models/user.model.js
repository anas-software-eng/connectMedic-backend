import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["patient", "doctor", "admin"],
      default: "patient",
    },
    // Touched on socket disconnect (once no tab is left open) so the chat UI
    // can show a real "last seen" instead of a canned status string.
    lastSeenAt: {
      type: Date,
      default: null,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
