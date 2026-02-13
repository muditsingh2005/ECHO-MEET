import { Router } from "express";
import {
  createMeeting,
  getMeetingById,
} from "../controllers/meeting.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/create", verifyJWT, createMeeting);
router.get("/:meetingId", verifyJWT, getMeetingById);

export default router;
