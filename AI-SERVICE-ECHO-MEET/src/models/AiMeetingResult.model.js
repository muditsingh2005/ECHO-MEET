import mongoose from "mongoose";

const aiMeetingResultSchema = new mongoose.Schema(
  {
    meetingId: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    hostId: {
      type: String,
      default: null,
    },
    users: [
      {
        userId: String,
        name: String,
        joinedAt: Date,
      },
    ],
    transcript: [
      {
        userId: String,
        name: String,
        text: String,
        timestamp: Date,
      },
    ],
    summary: {
      type: Object,
      default: null,
    },
    phases: {
      type: Object,
      default: {},
    },
    status: {
      type: String,
      enum: ["completed", "partial", "failed"],
      default: "partial",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  },
);

aiMeetingResultSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

aiMeetingResultSchema.pre(["findOneAndUpdate", "updateOne"], function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

const AiMeetingResult =
  mongoose.models.AiMeetingResult ||
  mongoose.model("AiMeetingResult", aiMeetingResultSchema);

export default AiMeetingResult;
