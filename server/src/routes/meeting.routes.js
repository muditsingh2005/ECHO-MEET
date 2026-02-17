import { Router } from "express";
import {
  createMeeting,
  getMeetingById,
  getUserMeetingHistory,
} from "../controllers/meeting.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/create", verifyJWT, createMeeting);
router.get("/user/history", verifyJWT, getUserMeetingHistory);
router.get("/:meetingId", verifyJWT, getMeetingById);

export default router;
