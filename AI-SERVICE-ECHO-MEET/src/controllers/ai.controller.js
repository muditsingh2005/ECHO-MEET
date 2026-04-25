import {
  createSession,
  appendAudioChunk,
  appendTranscript,
  endSession,
  getSession,
  hasSession,
  addUser,
} from "../services/session.service.js";

/**
 * POST /api/v1/ai/start-session
 * Body: { roomId }
 *
 * Creates an AI session for the given meeting room.
 * Idempotent — calling again with the same roomId returns the existing session.
 */
export const startSessionHandler = (req, res) => {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "roomId is required",
      });
    }

    const { session, created } = createSession(
      roomId,
      req.user.userId,
      req.user.name,
    );

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Session created" : "Session already exists",
      session,
    });
  } catch (error) {
    console.error("[AI-CONTROLLER] startSession error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start session",
    });
  }
};

/**
 * POST /api/v1/ai/stream-audio
 * Body (multipart): audio file (field "audio") + roomId field
 *
 * Appends an audio chunk to the active session and optionally
 * appends a transcript line if `transcript` text is provided.
 */
export const streamAudioHandler = (req, res) => {
  try {
    const { roomId, transcript } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "roomId is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No audio file provided",
      });
    }

    // Verify session exists
    const session = getSession(roomId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "No active session for this room. Call /start-session first.",
      });
    }

    // Append audio chunk (tagged with userId)
    const audioResult = appendAudioChunk(roomId, req.file.buffer, req.user.userId);
    if (!audioResult.success) {
      return res.status(404).json({
        success: false,
        message: audioResult.error,
      });
    }

    // Optionally append transcript text alongside the audio
    let transcriptResult = null;
    if (transcript && transcript.trim()) {
      transcriptResult = appendTranscript(
        roomId,
        req.user.userId,
        req.user.name,
        transcript.trim(),
      );
    }

    return res.status(200).json({
      success: true,
      message: "Audio chunk received",
      chunkIndex: audioResult.chunkIndex,
      totalChunks: audioResult.totalChunks,
      receivedBytes: req.file.size,
      ...(transcriptResult && {
        transcriptEntry: transcriptResult.entryIndex,
        totalTranscriptEntries: transcriptResult.totalEntries,
      }),
    });
  } catch (error) {
    console.error("[AI-CONTROLLER] streamAudio error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process audio chunk",
    });
  }
};

/**
 * POST /api/v1/ai/end-session
 * Body: { roomId }
 *
 * Finalizes the AI session — returns the full transcript and stats,
 * then deletes the session from memory.
 */
export const endSessionHandler = (req, res) => {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "roomId is required",
      });
    }

    const snapshot = endSession(roomId);

    if (!snapshot) {
      return res.status(404).json({
        success: false,
        message: "No active session found for this room",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Session ended",
      summary: snapshot,
    });
  } catch (error) {
    console.error("[AI-CONTROLLER] endSession error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to end session",
    });
  }
};

/**
 * POST /api/v1/ai/transcribe-chunk
 * Body (multipart): audio file (field "audio") + roomId, userId, userName, timestamp fields
 *
 * Called by the main signaling server to forward audio chunks.
 * Auto-creates a session if one doesn't exist for the room.
 */
export const transcribeChunkHandler = (req, res) => {
  try {
    const { roomId, userId, userName, timestamp } = req.body;

    if (!roomId || !userId) {
      return res.status(400).json({
        success: false,
        message: "roomId and userId are required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No audio file provided",
      });
    }

    // Auto-create session if it doesn't exist yet
    if (!hasSession(roomId)) {
      createSession(roomId, userId, userName || "Unknown");
    } else {
      // Make sure this user is tracked in the session
      addUser(roomId, userId, userName || "Unknown");
    }

    // Append audio chunk
    const audioResult = appendAudioChunk(roomId, req.file.buffer, userId);
    if (!audioResult.success) {
      return res.status(500).json({
        success: false,
        message: audioResult.error,
      });
    }

    // TODO: Plug in actual transcription engine here.
    // For now, acknowledge receipt. When a real STT engine is wired up,
    // return { transcription: "..." } so the signaling server can
    // broadcast it back to the meeting room.
    return res.status(200).json({
      success: true,
      message: "Audio chunk received for transcription",
      chunkIndex: audioResult.chunkIndex,
      totalChunks: audioResult.totalChunks,
      receivedBytes: req.file.size,
      userId,
      timestamp: timestamp || new Date().toISOString(),
      // transcription: null,  // ← will be populated by STT engine
    });
  } catch (error) {
    console.error("[AI-CONTROLLER] transcribeChunk error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process audio chunk for transcription",
    });
  }
};
