// An error with an HTTP status and machine-readable code, rendered by the app's error handler
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what = "Resource") => new HttpError(404, "NOT_FOUND", `${what} not found`);

// Wrap async route handlers so rejections reach the error handler
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
