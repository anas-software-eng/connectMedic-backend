import AuditLog from "../models/AuditLog.js";

// Fire-and-record for every admin action worth being accountable for.
export const logAdminAction = (admin, action, targetType, targetId, details = "") =>
  AuditLog.create({
    adminId: admin._id,
    adminName: admin.fullName,
    action,
    targetType,
    targetId: String(targetId || ""),
    details,
  });
