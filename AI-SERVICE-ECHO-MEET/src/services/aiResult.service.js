import AiMeetingResult from "../models/AiMeetingResult.model.js";
import { logger } from "../utils/logger.js";

export const saveAiResult = async ({
  meetingId,
  roomId,
  hostId,
  users,
  transcript,
  summary,
  phases,
  status = "completed",
}) => {
  if (!meetingId || !roomId) {
    throw new Error("meetingId and roomId are required to persist AI result");
  }

  try {
    const payload = {
      meetingId,
      roomId,
      hostId,
      users: Array.isArray(users) ? users : [],
      transcript: Array.isArray(transcript) ? transcript : [],
      summary: summary || null,
      phases: phases || {},
      status,
      updatedAt: new Date(),
    };

    const result = await AiMeetingResult.findOneAndUpdate(
      { meetingId },
      { $set: payload },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    logger.info("[AI-RESULT] Persisted result to MongoDB", {
      meetingId,
      roomId,
      summaryPresent: !!summary,
      transcriptLength: payload.transcript.length,
      status,
      persistedId: result?._id?.toString?.(),
    });

    return result;
  } catch (error) {
    logger.error("[AI-RESULT] Failed to persist result to MongoDB", error, {
      meetingId,
      roomId,
    });
    throw error;
  }
};

export const getPersistedAiResult = async (roomIdOrMeetingId) => {
  try {
    const result = await AiMeetingResult.findOne({
      $or: [{ roomId: roomIdOrMeetingId }, { meetingId: roomIdOrMeetingId }],
    }).lean();

    return result;
  } catch (error) {
    logger.error(
      "[AI-RESULT] Failed to fetch persisted result from MongoDB",
      error,
      {
        roomIdOrMeetingId,
      },
    );
    throw error;
  }
};
