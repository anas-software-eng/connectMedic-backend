import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";

import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173").split(",");
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Every connected socket for a user joins this room, so emitting to a user
// (not a specific tab/device) is a single `io.to(userRoom(id))` call.
export const userRoom = (userId) => `user:${userId}`;

const parseCookies = (header = "") => {
  const out = {};
  for (const pair of header.split(";")) {
    const i = pair.indexOf("=");
    if (i === -1) continue;
    const key = pair.slice(0, i).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(pair.slice(i + 1).trim());
    } catch {
      out[key] = pair.slice(i + 1).trim();
    }
  }
  return out;
};

// Identity comes from the same httpOnly JWT cookie protectRoute trusts —
// never from a client-supplied query param, which anyone could fake to
// impersonate another user and read their messages/presence.
io.use(async (socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = cookies.jwt;
    if (!token) return next(new Error("Unauthorized"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("_id");
    if (!user) return next(new Error("Unauthorized"));

    socket.userId = String(user._id);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

// userId -> number of open sockets (tabs/devices), so presence only flips to
// "offline" once every connection for that user is gone.
const onlineCounts = new Map();
const broadcastOnlineUsers = () => io.emit("getOnlineUsers", [...onlineCounts.keys()]);

export function getReceiverSocketId(userId) {
  const sockets = io.sockets.adapter.rooms.get(userRoom(userId));
  return sockets ? [...sockets][0] : undefined;
}

io.on("connection", (socket) => {
  const userId = socket.userId;
  socket.join(userRoom(userId));

  onlineCounts.set(userId, (onlineCounts.get(userId) || 0) + 1);
  broadcastOnlineUsers();

  socket.on("typing", ({ to } = {}) => {
    if (to) io.to(userRoom(to)).emit("typing", { from: userId });
  });
  socket.on("stopTyping", ({ to } = {}) => {
    if (to) io.to(userRoom(to)).emit("stopTyping", { from: userId });
  });

  // WebRTC signaling relay for video consultations — the server never
  // touches media, it just forwards offer/answer/ICE payloads peer-to-peer.
  // The offer itself doubles as the "incoming call" signal, so there's no
  // separate invite event to keep in sync with it.
  socket.on("call:offer", ({ to, offer } = {}) => {
    if (to) io.to(userRoom(to)).emit("call:offer", { from: userId, offer });
  });
  socket.on("call:answer", ({ to, answer } = {}) => {
    if (to) io.to(userRoom(to)).emit("call:answer", { from: userId, answer });
  });
  socket.on("call:ice-candidate", ({ to, candidate } = {}) => {
    if (to) io.to(userRoom(to)).emit("call:ice-candidate", { from: userId, candidate });
  });
  socket.on("call:decline", ({ to } = {}) => {
    if (to) io.to(userRoom(to)).emit("call:decline", { from: userId });
  });
  socket.on("call:end", ({ to } = {}) => {
    if (to) io.to(userRoom(to)).emit("call:end", { from: userId });
  });

  socket.on("disconnect", async () => {
    const remaining = (onlineCounts.get(userId) || 1) - 1;
    if (remaining <= 0) {
      onlineCounts.delete(userId);
      try {
        await User.findByIdAndUpdate(userId, { lastSeenAt: new Date() });
      } catch (error) {
        console.error("Error updating lastSeenAt:", error.message);
      }
    } else {
      onlineCounts.set(userId, remaining);
    }
    broadcastOnlineUsers();
  });
});

export { io, app, server };
