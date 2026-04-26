/**
 * AI Service Forwarder
 *
 * Lightweight abstraction for forwarding audio chunks from the
 * signaling server to the AI microservice. Uses native fetch()
 * (Node 18+) — no extra dependencies needed.
 *
 * All calls are fire-and-forget from the caller's perspective;
 * errors are logged but never block the signaling pipeline.
 */

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://localhost:5300";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

/**
 * Sleep helper for retry backoff.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Forward an audio chunk to the AI service's /transcribe-chunk endpoint.
 *
 * @param {Object}  params
 * @param {string}  params.roomId     — meeting room ID
 * @param {string}  params.userId     — sender's user ID
 * @param {string}  params.userName   — sender's display name
 * @param {Buffer}  params.audioData  — raw audio buffer
 * @param {string}  params.mimeType   — e.g. "audio/webm"
 * @param {string}  [params.token]    — JWT access token for AI service auth
 * @returns {Promise<Object|null>}    — AI service response or null on failure
 */
export const forwardAudioChunk = async ({
  roomId,
  userId,
  userName,
  audioData,
  mimeType = "audio/webm",
  token,
}) => {
  const url = `${AI_SERVICE_URL}/api/v1/ai/transcribe-chunk`;
  const timestamp = new Date().toISOString();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Build multipart form body using native FormData + Blob
      const formData = new FormData();
      formData.append("roomId", roomId);
      formData.append("userId", userId);
      formData.append("userName", userName);
      formData.append("timestamp", timestamp);
      formData.append(
        "audio",
        new Blob([audioData], { type: mimeType }),
        `chunk-${Date.now()}.webm`,
      );

      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
        signal: AbortSignal.timeout(10_000), // 10s timeout per attempt
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `AI service returned ${response.status}: ${errorBody}`,
        );
      }

      const data = await response.json();

      if (attempt > 0) {
        console.log(
          `[AI-FORWARDER] Succeeded on retry ${attempt} — room=${roomId}`,
        );
      }

      return data;
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;

      if (isLastAttempt) {
        console.error(
          `[AI-FORWARDER] Failed after ${MAX_RETRIES + 1} attempts — ` +
            `room=${roomId} user=${userId}: ${error.message}`,
        );
        return null;
      }

      console.warn(
        `[AI-FORWARDER] Attempt ${attempt + 1} failed — ` +
          `room=${roomId}: ${error.message}. Retrying in ${RETRY_DELAY_MS}ms...`,
      );

      await sleep(RETRY_DELAY_MS * (attempt + 1)); // linear backoff
    }
  }

  return null;
};

/**
 * Notify the AI service that a session should start for a room.
 *
 * @param {Object}  params
 * @param {string}  params.roomId
 * @param {string}  params.userId
 * @param {string}  params.userName
 * @param {string}  [params.token]
 */
export const notifySessionStart = async ({ roomId, userId, userName, token }) => {
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(
      `${AI_SERVICE_URL}/api/v1/ai/start-session`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ roomId }),
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (!response.ok) {
      const msg = await response.text().catch(() => "");
      console.error(`[AI-FORWARDER] start-session failed: ${response.status} ${msg}`);
      return null;
    }

    const data = await response.json();
    console.log(`[AI-FORWARDER] Session started — room=${roomId}`);
    return data;
  } catch (error) {
    console.error(`[AI-FORWARDER] start-session error: ${error.message}`);
    return null;
  }
};

/**
 * Notify the AI service that a session should end for a room.
 *
 * @param {Object}  params
 * @param {string}  params.roomId
 * @param {string}  [params.token]
 */
export const notifySessionEnd = async ({ roomId, token }) => {
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(
      `${AI_SERVICE_URL}/api/v1/ai/end-session`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ roomId }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      const msg = await response.text().catch(() => "");
      console.error(`[AI-FORWARDER] end-session failed: ${response.status} ${msg}`);
      return null;
    }

    const data = await response.json();
    console.log(`[AI-FORWARDER] Session ended — room=${roomId}`);
    return data;
  } catch (error) {
    console.error(`[AI-FORWARDER] end-session error: ${error.message}`);
    return null;
  }
};
