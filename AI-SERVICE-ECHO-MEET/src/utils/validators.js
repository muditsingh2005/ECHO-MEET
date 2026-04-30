/**
 * Request Validation Utilities
 *
 * Centralized validation for all incoming requests.
 */

import { ValidationError } from "../utils/errors.js";

const ROOM_ID_PATTERN = /^[a-zA-Z0-9\-_]+$/;
const USER_ID_PATTERN = /^[a-zA-Z0-9\-_]+$/;
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_TEXT_SIZE = 1 * 1024 * 1024; // 1MB
const MIN_AUDIO_SIZE = 1024; // 1KB

export const validators = {
  roomId: (value) => {
    if (!value || typeof value !== "string") {
      throw new ValidationError("roomId is required and must be a string");
    }

    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > 256) {
      throw new ValidationError("roomId must be between 1 and 256 characters");
    }

    if (!ROOM_ID_PATTERN.test(trimmed)) {
      throw new ValidationError("roomId contains invalid characters");
    }

    return trimmed;
  },

  userId: (value) => {
    if (!value || typeof value !== "string") {
      throw new ValidationError("userId is required and must be a string");
    }

    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > 256) {
      throw new ValidationError("userId must be between 1 and 256 characters");
    }

    if (!USER_ID_PATTERN.test(trimmed)) {
      throw new ValidationError("userId contains invalid characters");
    }

    return trimmed;
  },

  userName: (value) => {
    if (typeof value !== "string") {
      return "Unknown";
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return "Unknown";
    }

    if (trimmed.length > 512) {
      throw new ValidationError("userName must not exceed 512 characters");
    }

    return trimmed;
  },

  audioBuffer: (buffer) => {
    if (!Buffer.isBuffer(buffer)) {
      throw new ValidationError("audio must be a valid buffer");
    }

    if (buffer.length < MIN_AUDIO_SIZE) {
      throw new ValidationError(
        `audio is too small (minimum ${MIN_AUDIO_SIZE} bytes)`,
      );
    }

    if (buffer.length > MAX_AUDIO_SIZE) {
      throw new ValidationError(
        `audio exceeds maximum size of ${MAX_AUDIO_SIZE / 1024 / 1024}MB`,
      );
    }

    return buffer;
  },

  mimeType: (value = "audio/webm") => {
    const validTypes = [
      "audio/webm",
      "audio/wav",
      "audio/mpeg",
      "audio/ogg",
      "audio/flac",
    ];

    if (!validTypes.includes(value)) {
      throw new ValidationError(`Unsupported MIME type: ${value}`);
    }

    return value;
  },

  transcript: (value) => {
    if (typeof value !== "string") {
      throw new ValidationError("transcript must be a string");
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("transcript cannot be empty");
    }

    if (trimmed.length > MAX_TEXT_SIZE) {
      throw new ValidationError(
        `transcript exceeds maximum size of ${MAX_TEXT_SIZE / 1024}KB`,
      );
    }

    return trimmed;
  },

  language: (value = "en") => {
    const validLanguages = ["en", "es", "fr", "de", "ja", "zh"];
    if (!validLanguages.includes(value)) {
      throw new ValidationError(`Unsupported language: ${value}`);
    }
    return value;
  },
};

export default validators;
