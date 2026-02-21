import { Meeting } from "../models/Meeting.model.js";
import {
  addUser,
  removeUser,
  getParticipants,
  isUserInRoom,
} from "../utils/roomManager.js";

export const registerRoomHandlers = (socket, io) => {
  socket.on("join-room", async ({ meetingId }) => {
    try {
      if (!meetingId) {
        socket.emit("error", { message: "Meeting ID is required" });
        return;
      }

      const meeting = await Meeting.findOne({ meetingId });

      if (!meeting) {
        socket.emit("error", { message: "Meeting not found" });
        return;
      }

      socket.join(meetingId);

      // Join user-specific room for targeted signaling
      socket.join(socket.user.userId);

      socket.meetingId = meetingId;

      // Track user in room manager
      addUser(meetingId, socket.user.userId);

      const participants = getParticipants(meetingId);

      socket.emit("room-joined", {
        meetingId,
        userId: socket.user.userId,
        participants,
      });

      socket.to(meetingId).emit("user-joined", {
        userId: socket.user.userId,
        name: socket.user.name,
        email: socket.user.email,
      });

      console.log(`User ${socket.user.userId} joined room ${meetingId}`);
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  //WebRTC Signaling Events

  // Handle WebRTC offer
  socket.on("webrtc-offer", ({ meetingId, offer, to }) => {
    if (!meetingId) {
      socket.emit("error", { message: "Meeting ID is required" });
      return;
    }

    if (!isUserInRoom(meetingId, socket.user.userId)) {
      socket.emit("error", { message: "You are not part of this meeting" });
      return;
    }

    // Forward offer to target user
    io.to(to).emit("webrtc-offer-received", {
      meetingId,
      offer,
      from: socket.user.userId,
    });

    console.log(
      `WebRTC offer from ${socket.user.userId} to ${to} in room ${meetingId}`,
    );
  });

  // Handle WebRTC answer
  socket.on("webrtc-answer", ({ meetingId, answer, to }) => {
    // Validate meetingId is provided
    if (!meetingId) {
      socket.emit("error", { message: "Meeting ID is required" });
      return;
    }

    // Check if sender is part of the meeting
    if (!isUserInRoom(meetingId, socket.user.userId)) {
      socket.emit("error", { message: "You are not part of this meeting" });
      return;
    }

    // Forward answer to target user
    io.to(to).emit("webrtc-answer-received", {
      meetingId,
      answer,
      from: socket.user.userId,
    });

    console.log(
      `WebRTC answer from ${socket.user.userId} to ${to} in room ${meetingId}`,
    );
  });

  // Handle WebRTC ICE candidate
  socket.on("webrtc-ice-candidate", ({ meetingId, candidate, to }) => {
    // Validate meetingId is provided
    if (!meetingId) {
      socket.emit("error", { message: "Meeting ID is required" });
      return;
    }

    // Check if sender is part of the meeting
    if (!isUserInRoom(meetingId, socket.user.userId)) {
      socket.emit("error", { message: "You are not part of this meeting" });
      return;
    }

    // Forward ICE candidate to target user
    io.to(to).emit("webrtc-ice-candidate-received", {
      meetingId,
      candidate,
      from: socket.user.userId,
    });

    console.log(
      `WebRTC ICE candidate from ${socket.user.userId} to ${to} in room ${meetingId}`,
    );
  });

  // ============== End WebRTC Signaling Events ==============

  // Handle disconnection
  socket.on("disconnect", () => {
    if (socket.meetingId) {
      // Remove user from room manager
      removeUser(socket.meetingId, socket.user.userId);

      socket.to(socket.meetingId).emit("user-left", {
        userId: socket.user.userId,
        name: socket.user.name,
      });
      console.log(`User ${socket.user.userId} left room ${socket.meetingId}`);
    }
  });
};
