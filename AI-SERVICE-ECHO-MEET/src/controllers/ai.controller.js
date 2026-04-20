import {
  createSession,
  appendAudioChunk,
  endSession,
  getSession,
} from "../services/session.service.js";

/**
 * POST /api/v1/ai/start-session
 * Body: { roomId }
 *
 * Creates (or resumes) an AI session for the given meeting room.
 */
export const startSession = (req, res) => {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "roomId is required",
      });
    }

    const session = createSession(roomId, req.user.userId, req.user.name);

    return res.status(201).json({
      success: true,
      message: "Session started",
      session: {
        roomId: session.roomId,
        userId: session.userId,
        createdAt: session.createdAt,
      },
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
 * Body (multipart): audio file + roomId field
 *
 * Appends an audio chunk to the active session.
 */
export const streamAudio = (req, res) => {
  try {
    const { roomId } = req.body;

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

    const result = appendAudioChunk(roomId, req.file.buffer);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Audio chunk received",
      chunkIndex: result.chunkIndex,
      totalChunks: result.totalChunks,
      receivedBytes: req.file.size,
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
 * Ends the AI session and returns a summary.
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
