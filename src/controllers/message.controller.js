import mongoose from "mongoose";

import User from "../models/user.model.js";
import Doctor from "../models/Doctors.js";
import Appointment from "../models/Appointment.js";
import Message from "../models/message.model.js";

import cloudinary, { isCloudinaryConfigured } from "../lib/cloudinary.js";
import { io, userRoom } from "../lib/socket.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/AppError.js";

// The people a user is actually allowed to message: for a patient, every
// doctor they've ever booked; for a doctor, every patient who's booked them.
// Admins aren't part of anyone's care team, so they get an empty list.
const getCareTeamIds = async (user) => {
  if (user.role === "patient") {
    const doctorIds = await Appointment.distinct("doctorId", { patientId: user._id });
    const doctors = await Doctor.find({ _id: { $in: doctorIds } }).select("userId");
    return doctors.map((d) => d.userId);
  }
  if (user.role === "doctor") {
    const doctor = await Doctor.findOne({ userId: user._id }).select("_id");
    if (!doctor) return [];
    return Appointment.distinct("patientId", { doctorId: doctor._id });
  }
  return [];
};

export const getConversations = asyncHandler(async (req, res) => {
  const meId = req.user._id;
  const counterpartIds = await getCareTeamIds(req.user);

  if (counterpartIds.length === 0) return res.json([]);

  const users = await User.find({ _id: { $in: counterpartIds } })
    .select("fullName profilePic role lastSeenAt")
    .lean();

  const summaries = await Message.aggregate([
    {
      $match: {
        $or: [
          { senderId: meId, receiverId: { $in: counterpartIds } },
          { receiverId: meId, senderId: { $in: counterpartIds } },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { $cond: [{ $eq: ["$senderId", meId] }, "$receiverId", "$senderId"] },
        lastText: { $first: "$text" },
        lastImage: { $first: "$image" },
        lastAt: { $first: "$createdAt" },
        lastFromMe: { $first: { $eq: ["$senderId", meId] } },
        unreadCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$receiverId", meId] }, { $eq: ["$seenAt", null] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  const byId = new Map(summaries.map((s) => [String(s._id), s]));

  const conversations = users.map((u) => {
    const s = byId.get(String(u._id));
    return {
      _id: u._id,
      fullName: u.fullName,
      profilePic: u.profilePic,
      role: u.role,
      lastSeenAt: u.lastSeenAt,
      lastMessage: s ? s.lastText || (s.lastImage ? "Sent a photo" : "") : "",
      lastMessageAt: s?.lastAt || null,
      lastMessageFromMe: s?.lastFromMe || false,
      unreadCount: s?.unreadCount || 0,
    };
  });

  conversations.sort((a, b) => {
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
  });

  res.json(conversations);
});

export const getMessages = asyncHandler(async (req, res) => {
  const { id: otherId } = req.params;
  const myId = req.user._id;
  if (!mongoose.Types.ObjectId.isValid(otherId)) throw new AppError(400, "Invalid user id");

  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const filter = {
    $or: [
      { senderId: myId, receiverId: otherId },
      { senderId: otherId, receiverId: myId },
    ],
  };
  if (req.query.before) filter._id = { $lt: req.query.before };

  const page = await Message.find(filter).sort({ _id: -1 }).limit(limit).lean();
  const messages = page.reverse();
  const hasMore = page.length === limit;

  // Opening the thread is what "read" means here — clear any unseen
  // messages the other side sent us and let their UI know live.
  const seenResult = await Message.updateMany(
    { senderId: otherId, receiverId: myId, seenAt: null },
    { $set: { seenAt: new Date() } }
  );
  if (seenResult.modifiedCount > 0) {
    io.to(userRoom(otherId)).emit("messagesSeen", { by: String(myId) });
  }

  res.json({ messages, hasMore });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { text, image } = req.body;
  const { id: receiverId } = req.params;
  const senderId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(receiverId) || String(receiverId) === String(senderId)) {
    throw new AppError(400, "Invalid recipient");
  }
  if (!String(text || "").trim() && !image) {
    throw new AppError(400, "Message needs text or an image");
  }

  let imageUrl;
  if (image) {
    if (!isCloudinaryConfigured) {
      throw new AppError(400, "Image uploads are not configured on this server");
    }
    try {
      const uploadResponse = await cloudinary.uploader.upload(image, {});
      imageUrl = uploadResponse.secure_url;
    } catch (error) {
      const cloudinaryDetail = error?.error?.message;
      console.log("Error uploading message image ---", cloudinaryDetail || error?.message || error);
      throw new AppError(502, `Image upload failed: ${cloudinaryDetail || error?.message || "unknown error"}`);
    }
  }

  const newMessage = await Message.create({
    senderId,
    receiverId,
    text: String(text || "").trim(),
    image: imageUrl,
  });

  io.to(userRoom(receiverId)).emit("newMessage", newMessage);

  res.status(201).json(newMessage);
});
