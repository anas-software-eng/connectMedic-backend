import { AppError } from "../lib/AppError.js";

export const notFound = (req, res) => res.status(404).json({ message: "Route not found" });

// Last middleware in the chain — every asyncHandler-wrapped controller and
// any next(err) call lands here.
export const errorHandler = (err, req, res, _next) => {
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "value";
    return res.status(409).json({ message: `This ${field} is already in use` });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ message: "Invalid id" });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }

  const status = err instanceof AppError ? err.status : err?.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: err?.message || "Internal server error" });
};
