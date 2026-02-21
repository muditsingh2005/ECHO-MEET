import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema({
  meetingId: {
    type: Schema.Types.ObjectId,
    ref: "Meeting",
    required: true,
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Message = mongoose.model("Message", messageSchema);
