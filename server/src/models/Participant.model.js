import mongoose, { Schema } from "mongoose";

const participantSchema = new Schema({
  meetingId: {
    type: Schema.Types.ObjectId,
    ref: "Meeting",
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    enum: ["host", "participant"],
    default: "participant",
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  leftAt    : {
    type: Date,
  },
});

export const Participant = mongoose.model("Participant", participantSchema);