import {
  createSession,
  appendAudioChunk,
  appendTranscript,
  endSession,
  getSession,
  getTranscript,
  hasSession,
  addUser,
} from "../services/session.service.js";
import { transcribeAudio } from "../services/transcription.service.js";
import { assembleTranscript } from "../services/transcript.assembly.service.js";
import { summarizeMeeting } from "../services/summarization.service.js";
import { validators } from "../utils/validators.js";
import { responses } from "../utils/responses.js";
import { logger } from "../utils/logger.js";
import { ValidationError, NotFoundError, AppError } from "../utils/errors.js";

/**
 * POST /api/v1/ai/start-session
 * Body: { roomId }
 *
 * Creates an AI session for the given meeting room.
 * Idempotent — calling again with the same roomId returns the existing session.
 */
export const startSessionHandler = (req, res, next) => {
  try {
    const { roomId } = req.body;

    const validatedRoomId = validators.roomId(roomId);

    const { session, created } = createSession(
      validatedRoomId,
      req.user.userId,
      req.user.name,
    );

    logger.info("[START-SESSION] Session created", {
      roomId: validatedRoomId,
      userId: req.user.userId,
      isNew: created,
    });

    return res
      .status(created ? 201 : 200)
      .json(
        responses.success(
          session,
          created ? "Session created" : "Session already exists",
        ),
      );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/ai/stream-audio
 * Body (multipart): audio file (field "audio") + roomId field
 *
 * Appends an audio chunk to the active session and optionally
 * appends a transcript line if `transcript` text is provided.
 */
export const streamAudioHandler = (req, res, next) => {
  try {
    const { roomId, transcript } = req.body;

    const validatedRoomId = validators.roomId(roomId);

    if (!req.file?.buffer) {
      throw new ValidationError("No audio file provided");
    }

    validators.audioBuffer(req.file.buffer);

    const session = getSession(validatedRoomId);
    if (!session) {
      throw new NotFoundError(
        "No active session for this room. Call /start-session first.",
      );
    }

    const audioResult = appendAudioChunk(
      validatedRoomId,
      req.file.buffer,
      req.user.userId,
    );

    if (!audioResult.success) {
      throw new AppError(audioResult.error, 500, "AUDIO_CHUNK_ERROR");
    }

    let transcriptResult = null;
    if (transcript && transcript.trim()) {
      try {
        const validatedTranscript = validators.transcript(transcript);
        transcriptResult = appendTranscript(
          validatedRoomId,
          req.user.userId,
          req.user.name,
          validatedTranscript,
        );
      } catch (transcriptErr) {
        logger.warn("[STREAM-AUDIO] Transcript validation skipped", {
          error: transcriptErr.message,
        });
      }
    }

    logger.debug("[STREAM-AUDIO] Chunk received", {
      roomId: validatedRoomId,
      chunkIndex: audioResult.chunkIndex,
      bytes: req.file.size,
    });

    return res.status(200).json(
      responses.success(
        {
          chunkIndex: audioResult.chunkIndex,
          totalChunks: audioResult.totalChunks,
          receivedBytes: req.file.size,
          ...(transcriptResult && {
            transcriptEntry: transcriptResult.entryIndex,
            totalTranscriptEntries: transcriptResult.totalEntries,
          }),
        },
        "Audio chunk received",
      ),
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/ai/end-session
 * Body: { roomId }
 *
 * Orchestrates the full end-of-session pipeline:
 *   Phase 1 — Finalize session and release in-memory resources
 *   Phase 2 — Assemble raw transcript chunks into a clean transcript
 *   Phase 3 — Generate AI meeting summary via Llama 3.3
 *
 * Failure handling:
 *   - Session is deleted FIRST so resources are freed even if later steps fail
 *   - Transcript assembly failures → 500 (no transcript = no value)
 *   - Summarization failures → graceful degradation (transcript still returned)
 *   - Each phase reports its own status and timing in the response
 */
export const endSessionHandler = async (req, res, next) => {
  const startTime = Date.now();
  const phases = {
    sessionFinalized: { status: "pending", durationMs: 0 },
    transcriptAssembled: { status: "pending", durationMs: 0 },
    summaryGenerated: { status: "pending", durationMs: 0 },
  };

  try {
    const { roomId } = req.body;
    const validatedRoomId = validators.roomId(roomId);

    const p1Start = Date.now();
    const snapshot = endSession(validatedRoomId);
    phases.sessionFinalized.durationMs = Date.now() - p1Start;

    if (!snapshot) {
      phases.sessionFinalized.status = "not_found";
      throw new NotFoundError("No active session found for this room");
    }

    phases.sessionFinalized.status = "success";
    phases.sessionFinalized.details = {
      users: snapshot.users.length,
      rawChunks: snapshot.transcript.length,
      audioChunks: snapshot.totalAudioChunks,
      audioBytes: snapshot.totalAudioBytes,
    };

    logger.info("[END-SESSION] Phase 1 complete", {
      roomId: validatedRoomId,
      users: snapshot.users.length,
      chunks: snapshot.transcript.length,
      durationMs: phases.sessionFinalized.durationMs,
    });

    let assembled = null;
    const p2Start = Date.now();

    try {
      assembled = assembleTranscript(snapshot.transcript);
      phases.transcriptAssembled.durationMs = Date.now() - p2Start;
      phases.transcriptAssembled.status = "success";
      phases.transcriptAssembled.details = {
        segments: assembled.segments.length,
        speakers: assembled.speakerStats.length,
        totalWords: assembled.speakerStats.reduce(
          (sum, s) => sum + s.wordCount,
          0,
        ),
      };

      logger.info("[END-SESSION] Phase 2 complete", {
        roomId: validatedRoomId,
        segments: assembled.segments.length,
        words: phases.transcriptAssembled.details.totalWords,
        durationMs: phases.transcriptAssembled.durationMs,
      });
    } catch (assemblyError) {
      phases.transcriptAssembled.durationMs = Date.now() - p2Start;
      phases.transcriptAssembled.status = "failed";
      phases.transcriptAssembled.error = assemblyError.message;

      logger.error("[END-SESSION] Phase 2 FAILED", assemblyError, {
        roomId: validatedRoomId,
      });

      return res.status(200).json({
        success: true,
        message: "Session ended (transcript assembly failed)",
        summary: _buildSessionSummary(snapshot),
        transcript: null,
        meetingSummary: null,
        phases,
        totalDurationMs: Date.now() - startTime,
      });
    }

    let meetingSummary = null;
    const p3Start = Date.now();

    if (!assembled.fullText || assembled.fullText.trim().length === 0) {
      phases.summaryGenerated.durationMs = 0;
      phases.summaryGenerated.status = "skipped";
      phases.summaryGenerated.reason = "Empty transcript";

      logger.info("[END-SESSION] Phase 3 skipped", {
        roomId: validatedRoomId,
        reason: "Empty transcript",
      });
    } else {
      try {
        const summaryResult = await summarizeMeeting(assembled.fullText, {
          segments: assembled.segments,
          speakerStats: assembled.speakerStats,
        });

        phases.summaryGenerated.durationMs = Date.now() - p3Start;

        if (summaryResult.success) {
          meetingSummary = summaryResult.summary;
          phases.summaryGenerated.status = "success";

          logger.info("[END-SESSION] Phase 3 complete", {
            roomId: validatedRoomId,
            keyPoints: meetingSummary.keyPoints?.length || 0,
            actions: meetingSummary.actionItems?.length || 0,
            decisions: meetingSummary.decisions?.length || 0,
            durationMs: phases.summaryGenerated.durationMs,
          });
        } else {
          phases.summaryGenerated.status = "failed";
          phases.summaryGenerated.error = summaryResult.error;

          logger.warn("[END-SESSION] Phase 3 failed", {
            roomId: validatedRoomId,
            error: summaryResult.error,
          });
        }
      } catch (summaryError) {
        phases.summaryGenerated.durationMs = Date.now() - p3Start;
        phases.summaryGenerated.status = "failed";
        phases.summaryGenerated.error = summaryError.message;

        logger.error("[END-SESSION] Phase 3 exception", summaryError, {
          roomId: validatedRoomId,
        });
      }
    }

    const totalDurationMs = Date.now() - startTime;

    logger.info("[END-SESSION] Complete", {
      roomId: validatedRoomId,
      totalDurationMs,
      hasSummary: !!meetingSummary,
      hasTranscript: !!assembled,
    });

    return res.status(200).json({
      success: true,
      message: meetingSummary
        ? "Session ended successfully"
        : "Session ended (summary unavailable)",
      summary: _buildSessionSummary(snapshot),
      transcript: assembled,
      meetingSummary,
      phases,
      totalDurationMs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Build a clean session summary object from the raw snapshot.
 */
function _buildSessionSummary(snapshot) {
  return {
    roomId: snapshot.roomId,
    hostId: snapshot.hostId,
    createdAt: snapshot.createdAt,
    endedAt: snapshot.endedAt,
    users: snapshot.users,
    totalAudioChunks: snapshot.totalAudioChunks,
    totalAudioBytes: snapshot.totalAudioBytes,
    durationMs: snapshot.endedAt - snapshot.createdAt,
  };
}

/**
 * GET /api/v1/ai/transcript/:roomId
 *
 * Returns the assembled transcript for an active session (mid-meeting).
 */
export const getTranscriptHandler = (req, res, next) => {
  try {
    const { roomId } = req.params;
    const validatedRoomId = validators.roomId(roomId);

    const rawTranscript = getTranscript(validatedRoomId);

    if (!rawTranscript) {
      throw new NotFoundError("No active session found for this room");
    }

    const assembled = assembleTranscript(rawTranscript);
    responses.validateDataPresence(assembled, "transcript");

    logger.debug("[GET-TRANSCRIPT] Transcript retrieved", {
      roomId: validatedRoomId,
      segments: assembled.segments.length,
    });

    return res.status(200).json(
      responses.success(
        {
          roomId: validatedRoomId,
          entryCount: rawTranscript.length,
          transcript: assembled,
        },
        "Transcript retrieved",
      ),
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/ai/summarize
 * Body: { transcript } — the full text transcript to summarize
 *
 * Standalone endpoint for on-demand summarization of any transcript.
 */
export const summarizeHandler = async (req, res, next) => {
  try {
    const { transcript } = req.body;
    const validatedTranscript = validators.transcript(transcript);

    logger.info("[SUMMARIZE] Starting summarization", {
      transcriptLength: validatedTranscript.length,
    });

    const result = await summarizeMeeting(validatedTranscript);

    if (!result.success) {
      throw new AppError(result.error || "Summarization failed");
    }

    responses.validateDataPresence(result.summary, "summary");

    logger.info("[SUMMARIZE] Summarization complete", {
      keyPoints: result.summary.keyPoints?.length || 0,
      actions: result.summary.actionItems?.length || 0,
    });

    return res
      .status(200)
      .json(responses.success(result.summary, "Summary generated"));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/ai/transcribe-chunk
 * Body (multipart): audio file (field "audio") + roomId, userId, userName, timestamp fields
 *
 * Called by the main signaling server to forward audio chunks.
 * Auto-creates a session if one doesn't exist for the room.
 * Transcribes audio via Groq Whisper and stores the result.
 */
export const transcribeChunkHandler = async (req, res, next) => {
  try {
    const { roomId, userId, userName, timestamp } = req.body;

    const validatedRoomId = validators.roomId(roomId);
    const validatedUserId = validators.userId(userId);
    const validatedUserName = validators.userName(userName);

    if (!req.file?.buffer) {
      throw new ValidationError("No audio file provided");
    }

    validators.audioBuffer(req.file.buffer);
    validators.mimeType(req.file.mimetype || "audio/webm");

    if (!hasSession(validatedRoomId)) {
      createSession(validatedRoomId, validatedUserId, validatedUserName);
    } else {
      addUser(validatedRoomId, validatedUserId, validatedUserName);
    }

    const audioResult = appendAudioChunk(
      validatedRoomId,
      req.file.buffer,
      validatedUserId,
    );

    if (!audioResult.success) {
      throw new AppError(audioResult.error, 500, "AUDIO_CHUNK_ERROR");
    }

    const result = await transcribeAudio(
      req.file.buffer,
      req.file.mimetype || "audio/webm",
    );

    let transcription = null;
    if (result.success && result.text) {
      transcription = result.text;

      appendTranscript(
        validatedRoomId,
        validatedUserId,
        validatedUserName,
        transcription,
      );

      logger.info("[TRANSCRIBE] Audio transcribed", {
        roomId: validatedRoomId,
        userId: validatedUserId,
        textLength: transcription.length,
      });
    } else if (result.success && !result.text) {
      logger.debug("[TRANSCRIBE] Silent audio chunk", {
        roomId: validatedRoomId,
        userId: validatedUserId,
      });
    }

    return res.status(200).json(
      responses.success(
        {
          transcription,
          chunkIndex: audioResult.chunkIndex,
          totalChunks: audioResult.totalChunks,
          receivedBytes: req.file.size,
          silent: !transcription,
        },
        transcription ? "Audio transcribed" : "Silent audio chunk received",
      ),
    );
  } catch (error) {
    next(error);
  }
};
