import Notification from "../models/Notification.js";
import { io, userRoom } from "./socket.js";

// Persists a notification and pushes it live to the recipient if they're
// connected. Callers don't need to know or care whether the user is online.
export const notify = async (userId, { type, title, body = "", link = "" }) => {
  const notification = await Notification.create({ userId, type, title, body, link });
  io.to(userRoom(userId)).emit("notification:new", notification);
  return notification;
};
