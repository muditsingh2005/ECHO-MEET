/**
 * Custom Error Classes for AI Service
 *
 * Enables structured error responses and proper HTTP status codes.
 */

export class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    errorCode = "INTERNAL_ERROR",
    details = null,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "AUTH_ERROR");
    this.name = "AuthError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "Payload too large") {
    super(message, 413, "PAYLOAD_TOO_LARGE");
    this.name = "PayloadTooLargeError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429, "RATE_LIMITED");
    this.name = "RateLimitError";
  }
}

export class GroqError extends AppError {
  constructor(message, originalError = null) {
    const status = originalError?.status || 500;
    const errorCode = _getGroqErrorCode(originalError);

    super(
      message || originalError?.message || "Groq API error",
      status >= 400 ? status : 500,
      errorCode,
      {
        groqStatus: status,
        groqMessage: originalError?.message,
      },
    );

    this.name = "GroqError";
    this.originalError = originalError;
  }
}

const _getGroqErrorCode = (error) => {
  const status = error?.status;
  if (status === 401 || status === 403) return "GROQ_AUTH";
  if (status === 429) return "GROQ_RATE_LIMIT";
  if (status === 500 || status === 503) return "GROQ_SERVICE";
  if (status === 408) return "GROQ_TIMEOUT";
  return "GROQ_ERROR";
};
