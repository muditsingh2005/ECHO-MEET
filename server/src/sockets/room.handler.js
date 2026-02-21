import { Meeting } from "../models/Meeting.model.js";
import { Participant } from "../models/Participant.model.js";
import { Message } from "../models/Message.model.js";
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

      // Determine participant role
      const isHost =
        meeting.hostId.toString() === socket.user.userId.toString();
      const role = isHost ? "host" : "participant";

      // Create or update Participant document
      await Participant.findOneAndUpdate(
        {
          meetingId: meeting._id,
          userId: socket.user.userId,
        },
        {
          meetingId: meeting._id,
          userId: socket.user.userId,
          role,
          joinedAt: new Date(),
          leftAt: null,
        },
        {
          upsert: true,
          new: true,
        },
      );

      const participants = getParticipants(meetingId);

      // Fetch and send last 50 messages as chat history
      const chatHistory = await Message.find({ meetingId: meeting._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("senderId", "name")
        .lean();

      // Reverse to get chronological order and format for client
      const formattedHistory = chatHistory.reverse().map((msg) => ({
        senderId: msg.senderId._id,
        name: msg.senderId.name,
        content: msg.content,
        createdAt: msg.createdAt,
      }));

      socket.emit("chat-history", formattedHistory);

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

  // ============== Chat Events ==============

  // Handle send-message
  socket.on("send-message", async ({ meetingId, content }) => {
    try {
      if (!meetingId) {
        socket.emit("error", { message: "Meeting ID is required" });
        return;
      }

      if (!content || !content.trim()) {
        socket.emit("error", { message: "Message content is required" });
        return;
      }

      // Validate user is in meeting
      if (!isUserInRoom(meetingId, socket.user.userId)) {
        socket.emit("error", { message: "You are not part of this meeting" });
        return;
      }

      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        socket.emit("error", { message: "Meeting not found" });
        return;
      }

      // Save message to MongoDB
      const message = await Message.create({
        meetingId: meeting._id,
        senderId: socket.user.userId,
        content: content.trim(),
      });

      // Emit to entire meeting room
      io.to(meetingId).emit("receive-message", {
        senderId: socket.user.userId,
        name: socket.user.name,
        content: message.content,
        createdAt: message.createdAt,
      });

      console.log(`Message sent by ${socket.user.userId} in room ${meetingId}`);
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // ============== End Chat Events ==============

  // Handle disconnection
  socket.on("disconnect", async () => {
    if (socket.meetingId) {
      // Remove user from room manager
      removeUser(socket.meetingId, socket.user.userId);

      // Update Participant document with leftAt timestamp
      try {
        const meeting = await Meeting.findOne({ meetingId: socket.meetingId });
        if (meeting) {
          await Participant.findOneAndUpdate(
            {
              meetingId: meeting._id,
              userId: socket.user.userId,
            },
            {
              leftAt: new Date(),
            },
          );
        }
      } catch (error) {
        console.error("Error updating participant leftAt:", error);
      }

      socket.to(socket.meetingId).emit("user-left", {
        userId: socket.user.userId,
        name: socket.user.name,
      });
      console.log(`User ${socket.user.userId} left room ${socket.meetingId}`);
    }
  });
};
