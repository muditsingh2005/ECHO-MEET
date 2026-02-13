import { Router } from "express";
import { createMeeting } from "../controllers/meeting.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/create", verifyJWT, createMeeting);

export default router;
