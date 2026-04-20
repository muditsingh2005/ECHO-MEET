import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import {
  startSession,
  streamAudio,
  endSessionHandler,
} from "../controllers/ai.controller.js";

const router = Router();

// All AI routes require authentication
router.use(verifyJWT);

// POST /api/v1/ai/start-session   — create a new AI session for a meeting room
router.post("/start-session", startSession);

// POST /api/v1/ai/stream-audio    — send an audio chunk (multipart: field "audio")
router.post("/stream-audio", upload.single("audio"), streamAudio);

// POST /api/v1/ai/end-session     — end the session and get summary
router.post("/end-session", endSessionHandler);

export default router;
