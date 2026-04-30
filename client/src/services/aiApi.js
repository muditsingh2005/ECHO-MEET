import axios from "axios";
import { TokenStorage } from "./api";

/**
 * AI Service API client.
 * Talks to the AI-SERVICE-ECHO-MEET backend.
 */

const AI_BASE_URL =
  import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:5300";

const aiApi = axios.create({
  baseURL: `${AI_BASE_URL}/api/v1/ai`,
  headers: { "Content-Type": "application/json" },
  timeout: 60_000,
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error) => {
  const status = error?.response?.status;

  if (!status) return true;
  if (status >= 500) return true;

  return status === 408 || status === 429;
};

const buildUserFacingError = (error, fallbackMessage) => {
  if (axios.isCancel?.(error)) {
    return {
      type: "cancelled",
      userMessage: "Request was cancelled. Please try again.",
      originalError: error,
    };
  }

  if (error?.code === "ECONNABORTED") {
    return {
      type: "timeout",
      userMessage: "Service temporarily unavailable.",
      originalError: error,
    };
  }

  if (!error?.response) {
    return {
      type: "network",
      userMessage: "Service temporarily unavailable.",
      originalError: error,
    };
  }

  const status = error.response.status;
  if (status >= 500) {
    return {
      type: "service",
      userMessage: "Service temporarily unavailable.",
      originalError: error,
    };
  }

  if (status === 404) {
    return {
      type: "not_found",
      userMessage: fallbackMessage,
      originalError: error,
    };
  }

  return {
    type: "request",
    userMessage: fallbackMessage,
    originalError: error,
  };
};

const requestWithRetry = async (
  requestFactory,
  {
    retries = 2,
    retryDelayMs = 800,
    fallbackMessage = "Service temporarily unavailable.",
  } = {},
) => {
  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      const response = await requestFactory();
      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableError(error)) {
        const normalized = buildUserFacingError(error, fallbackMessage);
        const err = new Error(normalized.userMessage);
        err.type = normalized.type;
        err.userMessage = normalized.userMessage;
        err.originalError = normalized.originalError;
        throw err;
      }

      const backoffMs = retryDelayMs * (attempt + 1);
      await wait(backoffMs);
      attempt += 1;
    }
  }

  const normalized = buildUserFacingError(lastError, fallbackMessage);
  const err = new Error(normalized.userMessage);
  err.type = normalized.type;
  err.userMessage = normalized.userMessage;
  err.originalError = normalized.originalError;
  throw err;
};

// Attach JWT from localStorage on every request
aiApi.interceptors.request.use((config) => {
  const token = TokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Fetch the transcript for a currently active session.
 */
export const getSessionTranscript = async (roomId) => {
  return requestWithRetry(() => aiApi.get(`/transcript/${roomId}`), {
    fallbackMessage: "Transcript not available.",
  });
};

/**
 * End a session and get the full response (transcript + summary).
 */
export const endAISession = async (roomId, options = {}) =>
  requestWithRetry(() => aiApi.post("/end-session", { roomId }), {
    retries: options.retries ?? 2,
    retryDelayMs: options.retryDelayMs ?? 1000,
    fallbackMessage: "Service temporarily unavailable.",
  });

/**
 * On-demand summarization of any transcript text.
 */
export const summarizeTranscript = async (transcript) => {
  return requestWithRetry(() => aiApi.post("/summarize", { transcript }), {
    fallbackMessage: "Summary generation failed.",
  });
};

export default aiApi;
