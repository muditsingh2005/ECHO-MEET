import { Meeting } from "../models/Meeting.model.js";
import { addUser, removeUser, getParticipants } from "../utils/roomManager.js";

export const registerRoomHandlers = (socket, io) => {
  socket.on("join-room", async ({ meetingId }) => {
    try {
      // Validate meetingId is provided
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

      socket.meetingId = meetingId;

      // Track user in room manager
      addUser(meetingId, socket.user.userId);

      // Get current participants
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
