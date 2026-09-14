import Notification from "../models/Notification.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const getNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const filter = { userId: req.user._id };
  if (req.query.before) filter._id = { $lt: req.query.before };

  const [page, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ _id: -1 }).limit(limit).lean(),
    Notification.countDocuments({ userId: req.user._id, read: false }),
  ]);

  res.json({ notifications: page, hasMore: page.length === limit, unreadCount });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { read: true },
    { new: true }
  );
  res.json(notification || {});
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.json({ ok: true });
});
