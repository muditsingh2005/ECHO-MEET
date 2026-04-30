/**
 * Structured Logging Service
 *
 * Provides production-grade logging with:
 * - Structured JSON output
 * - Request context tracking
 * - Error telemetry
 * - No noisy console spam
 */

const LOG_LEVELS = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
};

const isDev = process.env.NODE_ENV !== "production";

const log = (level, message, context = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (isDev) {
    const color = {
      error: "\x1b[31m",
      warn: "\x1b[33m",
      info: "\x1b[36m",
      debug: "\x1b[35m",
      reset: "\x1b[0m",
    };
    console.log(
      `${color[level]}[${level.toUpperCase()}]${color.reset}`,
      message,
      context,
    );
  } else {
    console.log(JSON.stringify(entry));
  }
};

export const logger = {
  error: (message, context) => log(LOG_LEVELS.ERROR, message, context),
  warn: (message, context) => log(LOG_LEVELS.WARN, message, context),
  info: (message, context) => log(LOG_LEVELS.INFO, message, context),
  debug: (message, context) => log(LOG_LEVELS.DEBUG, message, context),

  request: (method, path, context = {}) =>
    logger.debug(`[REQUEST] ${method} ${path}`, context),

  response: (method, path, status, durationMs, context = {}) =>
    logger.info(
      `[RESPONSE] ${method} ${path} ${status} ${durationMs}ms`,
      context,
    ),

  groqCall: (operation, model, durationMs, context = {}) =>
    logger.info(`[GROQ] ${operation} (${model}) ${durationMs}ms`, context),

  error: (message, error, context = {}) => {
    const errorContext = {
      ...context,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStatus: error?.status,
      errorStack: isDev ? error?.stack : undefined,
    };
    log(LOG_LEVELS.ERROR, message, errorContext);
  },
};

export default logger;
