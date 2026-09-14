import { AppError } from "./AppError.js";

// Wraps a Zod schema as Express middleware: validates + coerces req.body and
// replaces it with the parsed value, or turns a bad payload into a clean 400
// before it ever reaches the controller.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues[0]?.message || "Invalid request body";
    return next(new AppError(400, message));
  }
  req.body = result.data;
  next();
};
