import { v4 as uuidv4 } from "uuid";
import { Meeting } from "../models/Meeting.model.js";

export const createMeeting = async (req, res) => {
  try {
    const { title, scheduledFor, description } = req.body;

    if (!title || !scheduledFor || !description) {
      return res.status(400).json({
        success: false,
        message: "Please provide title, scheduledFor, and description",
      });
    }

    const meetingId = uuidv4();

    const meeting = await Meeting.create({
      meetingId,
      hostId: req.user.userId,
      title,
      scheduledFor: new Date(scheduledFor),
      description,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      meetingId: meeting.meetingId,
    });
  } catch (error) {
    console.error("Error creating meeting:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Meeting ID already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
