/**
 * Transcription Service — Groq Whisper Large V3 Turbo
 *
 * Accepts raw audio buffers, sends them to Groq's speech-to-text API,
 * and returns the transcribed text. Silent/empty results are filtered out.
 */

import {
  groqWithRetry,
  validateGroqResponse,
} from "../utils/groqResilience.js";
import { GroqError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// ─── Groq Client (lazy-initialized) ─────────────────────────────
// The client is created on first use, not at import time.
// This lets the server boot even without GROQ_API_KEY set.

let _groqClient = null;

async function getGroqClient() {
  if (!_groqClient) {
    const { default: Groq } = await import("groq-sdk");
    _groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groqClient;
}

const MODEL = "whisper-large-v3-turbo";

/**
 * Transcribe a raw audio buffer using Groq Whisper.
 *
 * @param {Buffer}  audioBuffer  — raw audio data (webm, wav, mp3, etc.)
 * @param {string}  [mimeType]   — MIME type of the audio (default: "audio/webm")
 * @param {string}  [language]   — ISO-639-1 language code (default: "en")
 * @returns {Promise<{ success: boolean, text?: string, error?: string }>}
 */
export const transcribeAudio = async (
  audioBuffer,
  mimeType = "audio/webm",
  language = "en",
) => {
  if (!process.env.GROQ_API_KEY) {
    logger.error("[TRANSCRIPTION] GROQ_API_KEY is not set");
    throw new GroqError("GROQ_API_KEY not configured", null, 500, "GROQ_AUTH");
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    throw new GroqError("Empty audio buffer", null, 400, "GROQ_ERROR");
  }

  const groq = await getGroqClient();
  const ext = _mimeToExt(mimeType);
  const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

  try {
    const transcription = await groqWithRetry(
      "transcribe_audio",
      () =>
        groq.audio.transcriptions.create({
          file,
          model: MODEL,
          language,
          response_format: "verbose_json",
        }),
      { maxRetries: 3, timeoutMs: 60000 },
    );

    validateGroqResponse(transcription, ["text"]);

    const text = transcription.text?.trim();

    if (!text || _isSilent(text)) {
      logger.debug("[TRANSCRIPTION] Silent audio detected", {
        mimeType,
        language,
      });
      return { success: true, text: null, silent: true };
    }

    logger.info("[TRANSCRIPTION] Audio transcribed successfully", {
      textLength: text.length,
      language: transcription.language || language,
      segmentCount: transcription.segments?.length || 0,
    });

    return {
      success: true,
      text,
      language: transcription.language || language,
      duration: transcription.duration || null,
      segments: transcription.segments || [],
    };
  } catch (error) {
    if (error instanceof GroqError) {
      logger.error("[TRANSCRIPTION] Groq API error", error, {
        operation: "transcribe_audio",
        groqErrorCode: error.groqErrorCode,
      });
      throw error;
    }

    logger.error("[TRANSCRIPTION] Unexpected error", error);
    throw new GroqError(
      error.message || "Transcription failed",
      error,
      500,
      "GROQ_ERROR",
    );
  }
};

// ─── Internal Helpers ────────────────────────────────────────────

/**
 * Map common MIME types to file extensions.
 */
function _mimeToExt(mimeType) {
  const map = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "application/octet-stream": "webm", // fallback for raw chunks
  };
  return map[mimeType] || "webm";
}

/**
 * Detect "silent" transcription results that should be ignored.
 * Whisper sometimes returns filler text for silence.
 */
function _isSilent(text) {
  if (!text) return true;

  const lower = text.toLowerCase().trim();

  // Common Whisper hallucinations on silence
  const silentPatterns = [
    "",
    ".",
    "...",
    "you",
    "thank you.",
    "thanks for watching.",
    "thanks for watching!",
    "thank you for watching.",
    "see you next time.",
    "bye.",
    "bye-bye.",
    "the end.",
    "[silence]",
    "(silence)",
    "♪",
    "subscribe",
    "like and subscribe",
  ];

  if (silentPatterns.includes(lower)) return true;

  // Very short single-word results are likely noise
  if (lower.length <= 2) return true;

  return false;
}
