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
export const endSessionHandler = async (req, res) => {
  const startTime = Date.now();
  const phases = {
    sessionFinalized: { status: "pending", durationMs: 0 },
    transcriptAssembled: { status: "pending", durationMs: 0 },
    summaryGenerated: { status: "pending", durationMs: 0 },
  };

  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "roomId is required",
      });
    }

    // ── Phase 1: Finalize session ──────────────────────────────
    // Delete from memory FIRST to guarantee resource cleanup.
    // We capture the snapshot before deletion so downstream steps
    // can still process the data.
    const p1Start = Date.now();
    const snapshot = endSession(roomId);
    phases.sessionFinalized.durationMs = Date.now() - p1Start;

    if (!snapshot) {
      phases.sessionFinalized.status = "not_found";
      return res.status(404).json({
        success: false,
        message: "No active session found for this room",
        phases,
      });
    }

    phases.sessionFinalized.status = "success";
    phases.sessionFinalized.details = {
      users: snapshot.users.length,
      rawChunks: snapshot.transcript.length,
      audioChunks: snapshot.totalAudioChunks,
      audioBytes: snapshot.totalAudioBytes,
    };

    console.log(
      `[END-SESSION] Phase 1 complete — room=${roomId} ` +
        `users=${snapshot.users.length} chunks=${snapshot.transcript.length}`,
    );

    // ── Phase 2: Assemble transcript ───────────────────────────
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

      console.log(
        `[END-SESSION] Phase 2 complete — room=${roomId} ` +
          `segments=${assembled.segments.length} ` +
          `words=${phases.transcriptAssembled.details.totalWords}`,
      );
    } catch (assemblyError) {
      phases.transcriptAssembled.durationMs = Date.now() - p2Start;
      phases.transcriptAssembled.status = "failed";
      phases.transcriptAssembled.error = assemblyError.message;

      console.error(
        `[END-SESSION] Phase 2 FAILED — room=${roomId}: ${assemblyError.message}`,
      );

      // Transcript assembly is critical — return what we have
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

    // ── Phase 3: Generate meeting summary ──────────────────────
    // Only attempt if we have actual transcript content.
    let meetingSummary = null;
    const p3Start = Date.now();

    if (!assembled.fullText || assembled.fullText.trim().length === 0) {
      phases.summaryGenerated.durationMs = 0;
      phases.summaryGenerated.status = "skipped";
      phases.summaryGenerated.reason = "Empty transcript";

      console.log(
        `[END-SESSION] Phase 3 skipped — room=${roomId} (empty transcript)`,
      );
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

          console.log(
            `[END-SESSION] Phase 3 complete — room=${roomId} ` +
              `keyPoints=${meetingSummary.keyPoints?.length || 0} ` +
              `actions=${meetingSummary.actionItems?.length || 0} ` +
              `decisions=${meetingSummary.decisions?.length || 0}`,
          );
        } else {
          phases.summaryGenerated.status = "failed";
          phases.summaryGenerated.error = summaryResult.error;

          console.warn(
            `[END-SESSION] Phase 3 FAILED — room=${roomId}: ${summaryResult.error}`,
          );
        }
      } catch (summaryError) {
        phases.summaryGenerated.durationMs = Date.now() - p3Start;
        phases.summaryGenerated.status = "failed";
        phases.summaryGenerated.error = summaryError.message;

        console.error(
          `[END-SESSION] Phase 3 FAILED (exception) — room=${roomId}: ${summaryError.message}`,
        );
      }
    }

    // ── Response ───────────────────────────────────────────────
    const totalDurationMs = Date.now() - startTime;

    console.log(
      `[END-SESSION] Complete — room=${roomId} total=${totalDurationMs}ms ` +
        `(p1=${phases.sessionFinalized.durationMs}ms ` +
        `p2=${phases.transcriptAssembled.durationMs}ms ` +
        `p3=${phases.summaryGenerated.durationMs}ms)`,
    );

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
    console.error("[AI-CONTROLLER] endSession fatal error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to end session",
      error: error.message,
      phases,
      totalDurationMs: Date.now() - startTime,
    });
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
export const getTranscriptHandler = (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "roomId is required",
      });
    }

    const rawTranscript = getTranscript(roomId);

    if (!rawTranscript) {
      return res.status(404).json({
        success: false,
        message: "No active session found for this room",
      });
    }

    const assembled = assembleTranscript(rawTranscript);

    return res.status(200).json({
      success: true,
      roomId,
      entryCount: rawTranscript.length,
      transcript: assembled,
    });
  } catch (error) {
    console.error("[AI-CONTROLLER] getTranscript error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve transcript",
    });
  }
};

/**
 * POST /api/v1/ai/summarize
 * Body: { transcript } — the full text transcript to summarize
 *
 * Standalone endpoint for on-demand summarization of any transcript.
 */
export const summarizeHandler = async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({
        success: false,
        message: "transcript text is required",
      });
    }

    const result = await summarizeMeeting(transcript.trim());

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || "Summarization failed",
      });
    }

    return res.status(200).json({
      success: true,
      summary: result.summary,
    });
  } catch (error) {
    console.error("[AI-CONTROLLER] summarize error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate summary",
    });
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
export const transcribeChunkHandler = async (req, res) => {
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
      addUser(roomId, userId, userName || "Unknown");
    }

    // Append raw audio chunk to session
    const audioResult = appendAudioChunk(roomId, req.file.buffer, userId);
    if (!audioResult.success) {
      return res.status(500).json({
        success: false,
        message: audioResult.error,
      });
    }

    // Transcribe via Groq Whisper
    const result = await transcribeAudio(
      req.file.buffer,
      req.file.mimetype || "audio/webm",
    );

    // If transcription succeeded and is not silent, store it
    let transcription = null;
    if (result.success && result.text) {
      transcription = result.text;

      appendTranscript(
        roomId,
        userId,
        userName || "Unknown",
        transcription,
      );

      console.log(
        `[TRANSCRIBE] room=${roomId} user=${userId}: "${transcription}"`,
      );
    }

    return res.status(200).json({
      success: true,
      message: result.silent
        ? "Audio chunk received (silent)"
        : "Audio chunk transcribed",
      chunkIndex: audioResult.chunkIndex,
      totalChunks: audioResult.totalChunks,
      receivedBytes: req.file.size,
      userId,
      timestamp: timestamp || new Date().toISOString(),
      transcription,
      silent: result.silent || false,
      ...(result.duration && { audioDuration: result.duration }),
    });
  } catch (error) {
    console.error("[AI-CONTROLLER] transcribeChunk error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process audio chunk for transcription",
    });
  }
};
