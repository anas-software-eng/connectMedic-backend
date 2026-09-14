import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    seenAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Covers both directions of a 1:1 thread lookup and keeps history fetches
// (sorted newest-first for pagination) off a collection scan.
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
