/**
 * Centralized Error Handling Middleware
 *
 * Converts all errors into consistent structured JSON responses.
 * Always returns { success: false, message, errorCode, details? }.
 */

import { logger } from "../utils/logger.js";
import { AppError } from "../utils/errors.js";

export const errorHandler = (err, _req, res, _next) => {
  const startTime = Date.now();

  if (err instanceof AppError) {
    const durationMs = Date.now() - startTime;
    logger.error(`[ERROR-HANDLER] ${err.name}`, err, {
      errorCode: err.errorCode,
      statusCode: err.statusCode,
      durationMs,
    });

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorCode: err.errorCode,
      ...(err.details && { details: err.details }),
    });
  }

  if (err.name === "PayloadTooLargeError") {
    logger.warn(`[ERROR-HANDLER] Payload too large`, { size: err.size });
    return res.status(413).json({
      success: false,
      message: "Request payload exceeds maximum size",
      errorCode: "PAYLOAD_TOO_LARGE",
    });
  }

  if (err.name === "SyntaxError" && err instanceof SyntaxError) {
    logger.warn(`[ERROR-HANDLER] JSON parse error`, { message: err.message });
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body",
      errorCode: "INVALID_JSON",
    });
  }

  const durationMs = Date.now() - startTime;
  logger.error(`[ERROR-HANDLER] Unhandled error`, err, {
    name: err.name,
    durationMs,
  });

  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
    errorCode: "INTERNAL_ERROR",
  });
};

export default errorHandler;
