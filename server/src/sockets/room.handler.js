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

  // Handle remove-user (host only)
  socket.on("remove-user", async ({ meetingId, targetUserId }) => {
    try {
      if (!meetingId) {
        socket.emit("error", { message: "Meeting ID is required" });
        return;
      }

      if (!targetUserId) {
        socket.emit("error", { message: "Target user ID is required" });
        return;
      }

      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        socket.emit("error", { message: "Meeting not found" });
        return;
      }

      // Validate caller is the host
      const isHost =
        meeting.hostId.toString() === socket.user.userId.toString();
      if (!isHost) {
        socket.emit("error", { message: "Only the host can remove users" });
        return;
      }

      // Prevent host from removing themselves
      if (targetUserId === socket.user.userId.toString()) {
        socket.emit("error", { message: "Host cannot remove themselves" });
        return;
      }

      // Check if target user is in the meeting
      if (!isUserInRoom(meetingId, targetUserId)) {
        socket.emit("error", { message: "User is not in this meeting" });
        return;
      }

      // Find target user's socket and disconnect
      const sockets = await io.in(meetingId).fetchSockets();
      const targetSocket = sockets.find(
        (s) => s.user && s.user.userId.toString() === targetUserId,
      );

      if (targetSocket) {
        // Remove from room manager
        removeUser(meetingId, targetUserId);

        // Update Participant document
        await Participant.findOneAndUpdate(
          {
            meetingId: meeting._id,
            userId: targetUserId,
          },
          {
            leftAt: new Date(),
          },
        );

        // Notify the removed user
        targetSocket.emit("removed-from-meeting", {
          meetingId,
          reason: "You have been removed by the host",
        });

        // Disconnect target from the meeting room
        targetSocket.leave(meetingId);
        targetSocket.meetingId = null;

        // Broadcast to room that user was removed
        io.to(meetingId).emit("user-removed", {
          userId: targetUserId,
          removedBy: socket.user.userId,
        });

        console.log(
          `User ${targetUserId} removed from meeting ${meetingId} by host ${socket.user.userId}`,
        );
      }
    } catch (error) {
      console.error("Error removing user:", error);
      socket.emit("error", { message: "Failed to remove user" });
    }
  });

  // Handle end-meeting (host only)
  socket.on("end-meeting", async ({ meetingId }) => {
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

      // Validate caller is the host
      const isHost =
        meeting.hostId.toString() === socket.user.userId.toString();
      if (!isHost) {
        socket.emit("error", { message: "Only the host can end the meeting" });
        return;
      }

      // Set meeting as inactive
      await Meeting.findOneAndUpdate({ meetingId }, { isActive: false });

      // Update all participants' leftAt
      await Participant.updateMany(
        {
          meetingId: meeting._id,
          leftAt: null,
        },
        {
          leftAt: new Date(),
        },
      );

      // Notify all users in the room
      io.to(meetingId).emit("meeting-ended", {
        meetingId,
        endedBy: socket.user.userId,
      });

      // Disconnect all sockets from the room
      const sockets = await io.in(meetingId).fetchSockets();
      for (const s of sockets) {
        // Remove from room manager
        if (s.user) {
          removeUser(meetingId, s.user.userId);
        }
        s.leave(meetingId);
        s.meetingId = null;
      }

      console.log(`Meeting ${meetingId} ended by host ${socket.user.userId}`);
    } catch (error) {
      console.error("Error ending meeting:", error);
      socket.emit("error", { message: "Failed to end meeting" });
    }
  });

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
