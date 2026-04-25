import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import {
  startSessionHandler,
  streamAudioHandler,
  endSessionHandler,
  transcribeChunkHandler,
} from "../controllers/ai.controller.js";

const router = Router();

// All AI routes require authentication
router.use(verifyJWT);

// POST /api/v1/ai/start-session   — create a new AI session for a meeting room
router.post("/start-session", startSessionHandler);

// POST /api/v1/ai/stream-audio    — send an audio chunk + optional transcript text
router.post("/stream-audio", upload.single("audio"), streamAudioHandler);

// POST /api/v1/ai/end-session     — finalize session, return transcript + stats, delete
router.post("/end-session", endSessionHandler);

// POST /api/v1/ai/transcribe-chunk — receive forwarded audio from signaling server
router.post("/transcribe-chunk", upload.single("audio"), transcribeChunkHandler);

export default router;
