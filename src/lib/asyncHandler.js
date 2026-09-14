// Wraps an async Express handler so a rejected promise reaches next(err)
// (and the centralized error handler) instead of crashing the process.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
