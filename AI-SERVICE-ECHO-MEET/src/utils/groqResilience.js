/**
 * Groq API Resilience Wrapper
 *
 * Wraps Groq API calls with:
 * - Automatic retry with exponential backoff
 * - Timeout handling
 * - Rate limit detection and backoff
 * - Structured error normalization
 * - Request/response logging
 */

import { GroqError } from "./errors.js";
import { logger } from "./logger.js";

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 800;
const RATE_LIMIT_BACKOFF_MS = 5000;
const REQUEST_TIMEOUT_MS = 60000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error) => {
  const status = error?.status;

  if (!status) return true;
  if (status === 408 || status === 429) return true;
  if (status >= 500) return true;

  return false;
};

const isRateLimitError = (error) => {
  return error?.status === 429;
};

const calculateBackoff = (attempt, isRateLimit = false) => {
  if (isRateLimit) {
    return RATE_LIMIT_BACKOFF_MS * (attempt + 1);
  }

  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
};

export const groqWithRetry = async (operation, apiCall, options = {}) => {
  const {
    maxRetries = MAX_RETRIES,
    timeoutMs = REQUEST_TIMEOUT_MS,
    onRetry = null,
  } = options;

  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    try {
      const startTime = Date.now();

      const promise = Promise.resolve(apiCall());

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Groq API request timeout")),
          timeoutMs,
        );
      });

      const result = await Promise.race([promise, timeoutPromise]);

      const durationMs = Date.now() - startTime;
      logger.groqCall(operation, result?.model || "unknown", durationMs, {
        attempt: attempt + 1,
        status: "success",
      });

      return result;
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt >= maxRetries;
      const isRetryable = isRetryableError(error);
      const isRateLimit = isRateLimitError(error);

      logger.warn(`[GROQ] ${operation} attempt ${attempt + 1} failed`, {
        errorMessage: error?.message,
        errorStatus: error?.status,
        isRetryable,
        isRateLimit,
        isLastAttempt,
      });

      if (isLastAttempt || !isRetryable) {
        break;
      }

      const backoffMs = calculateBackoff(attempt, isRateLimit);
      logger.info(`[GROQ] Retrying ${operation} in ${backoffMs}ms...`, {
        attempt: attempt + 1,
      });

      if (onRetry) {
        onRetry({
          attempt: attempt + 1,
          backoffMs,
          error: error?.message,
        });
      }

      await sleep(backoffMs);
      attempt += 1;
    }
  }

  throw new GroqError(
    `${operation} failed after ${attempt + 1} attempts`,
    lastError,
  );
};

export const validateGroqResponse = (response, expectedFields = []) => {
  if (!response) {
    throw new GroqError("Empty response from Groq API");
  }

  for (const field of expectedFields) {
    if (!(field in response)) {
      throw new GroqError(`Missing expected field in response: ${field}`);
    }
  }

  return response;
};

export const validateGroqCompletion = (completion) => {
  if (!completion?.choices?.[0]?.message?.content) {
    throw new GroqError("Invalid completion response structure");
  }

  const content = completion.choices[0].message.content.trim();
  if (content.length === 0) {
    throw new GroqError("Empty response content from Groq");
  }

  return content;
};

export const parseGroqJSON = (content) => {
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new GroqError(
      `Invalid JSON response from Groq: ${err.message}`,
      null,
    );
  }
};

export default {
  groqWithRetry,
  validateGroqResponse,
  validateGroqCompletion,
  parseGroqJSON,
};
