import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import {
  startSessionHandler,
  streamAudioHandler,
  endSessionHandler,
  getTranscriptHandler,
  summarizeHandler,
  transcribeChunkHandler,
} from "../controllers/ai.controller.js";

const router = Router();

// All AI routes require authentication
router.use(verifyJWT);

// POST /api/v1/ai/start-session   — create a new AI session for a meeting room
router.post("/start-session", startSessionHandler);

// POST /api/v1/ai/stream-audio    — send an audio chunk + optional transcript text
router.post("/stream-audio", upload.single("audio"), streamAudioHandler);

// POST /api/v1/ai/end-session     — finalize session, assemble transcript + summary, delete
router.post("/end-session", endSessionHandler);

// GET  /api/v1/ai/transcript/:roomId — get assembled transcript for an active session
router.get("/transcript/:roomId", getTranscriptHandler);

// POST /api/v1/ai/summarize       — on-demand summarization of any transcript text
router.post("/summarize", summarizeHandler);

// POST /api/v1/ai/transcribe-chunk — receive forwarded audio from signaling server
router.post("/transcribe-chunk", upload.single("audio"), transcribeChunkHandler);

export default router;

