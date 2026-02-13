import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true,
  },
  hostId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    // default:true,
  },
  scheduledFor: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  // startTime :{
  //     type:Date,
  //     required:true,
  // },
  // endTime :{
  //     type:Date,
  //     required:true,
  // },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Meeting = mongoose.model("Meeting", meetingSchema);
