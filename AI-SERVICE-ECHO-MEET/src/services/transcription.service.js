/**
 * Transcription Service — Groq Whisper Large V3 Turbo
 *
 * Accepts raw audio buffers, sends them to Groq's speech-to-text API,
 * and returns the transcribed text. Silent/empty results are filtered out.
 */

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
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

/**
 * Sleep helper for retry backoff.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    console.error("[TRANSCRIPTION] GROQ_API_KEY is not set");
    return { success: false, error: "GROQ_API_KEY not configured" };
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    return { success: false, error: "Empty audio buffer" };
  }

  const groq = await getGroqClient();

  // Determine file extension from MIME type for the File object name
  const ext = _mimeToExt(mimeType);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Groq SDK expects a File-like object. We create one from the buffer.
      const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

      const transcription = await groq.audio.transcriptions.create({
        file,
        model: MODEL,
        language,
        response_format: "verbose_json", // gives us segment-level timestamps
      });

      const text = transcription.text?.trim();

      // Filter out silent/empty results
      if (!text || _isSilent(text)) {
        return { success: true, text: null, silent: true };
      }

      if (attempt > 0) {
        console.log(
          `[TRANSCRIPTION] Succeeded on retry ${attempt}`,
        );
      }

      return {
        success: true,
        text,
        language: transcription.language || language,
        duration: transcription.duration || null,
        segments: transcription.segments || [],
      };
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;

      // Don't retry on client errors (400-level) except rate limits
      if (error?.status >= 400 && error?.status < 500 && error?.status !== 429) {
        console.error(
          `[TRANSCRIPTION] Client error (${error.status}): ${error.message}`,
        );
        return { success: false, error: error.message };
      }

      if (isLastAttempt) {
        console.error(
          `[TRANSCRIPTION] Failed after ${MAX_RETRIES + 1} attempts: ${error.message}`,
        );
        return { success: false, error: error.message };
      }

      const delay = RETRY_DELAY_MS * (attempt + 1);
      console.warn(
        `[TRANSCRIPTION] Attempt ${attempt + 1} failed: ${error.message}. ` +
          `Retrying in ${delay}ms...`,
      );
      await sleep(delay);
    }
  }

  return { success: false, error: "Max retries exceeded" };
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
