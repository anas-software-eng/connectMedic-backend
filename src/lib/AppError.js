// Throw this from a controller for an expected failure (bad input, not
// found, forbidden, conflict); the centralized error handler turns it into
// the right HTTP response without every controller repeating try/catch.
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
