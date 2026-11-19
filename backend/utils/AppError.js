/**
 * An error with an HTTP status code that is safe to show to users.
 * Throw it from controllers; middleware/error.js turns it into JSON.
 */
class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

module.exports = AppError;
