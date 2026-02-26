import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context";
import api from "../services/api";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket";
import "./MeetingPage.css";

// ICE Server configuration
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
  </svg>
);

const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
  </svg>
);

const VideoOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
  </svg>
);

const CallEndIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
  </svg>
);

const CopyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const MeetingPage = () => {
  const { meetingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [participants, setParticipants] = useState([]);
  const [totalParticipants, setTotalParticipants] = useState(1); // Include self
  const [isHost, setIsHost] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef(null);

  // WebRTC state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const peerConnectionsRef = useRef(new Map());
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  // WebRTC helper: Create peer connection for a user
  const createPeerConnection = useCallback(
    (userId, socket) => {
      // Check if connection already exists
      if (peerConnectionsRef.current.has(userId)) {
        return peerConnectionsRef.current.get(userId);
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[WebRTC] Sending ICE candidate to:", userId);
          socket.emit("webrtc-ice-candidate", {
            meetingId,
            candidate: event.candidate,
            to: userId,
          });
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log("[WebRTC] Received remote track from:", userId);
        const remoteStream = event.streams[0];
        setRemoteStreams((prev) => {
          const updated = new Map(prev);
          updated.set(userId, remoteStream);
          return updated;
        });
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(
          `[WebRTC] Connection state with ${userId}:`,
          pc.connectionState,
        );
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          console.log("[WebRTC] Connection failed/disconnected, cleaning up");
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(
          `[WebRTC] ICE connection state with ${userId}:`,
          pc.iceConnectionState,
        );
      };

      peerConnectionsRef.current.set(userId, pc);
      return pc;
    },
    [meetingId],
  );

  // WebRTC helper: Send offer to a user (existing user → new user)
  const sendOffer = useCallback(
    async (targetUserId, socket) => {
      console.log("[WebRTC] Creating offer for:", targetUserId);
      const pc = createPeerConnection(targetUserId, socket);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
          meetingId,
          offer: pc.localDescription,
          to: targetUserId,
        });
        console.log("[WebRTC] Offer sent to:", targetUserId);
      } catch (err) {
        console.error("[WebRTC] Error creating offer:", err);
      }
    },
    [createPeerConnection, meetingId],
  );

  // WebRTC helper: Handle incoming offer
  const handleOffer = useCallback(
    async (data, socket) => {
      const { offer, from } = data;
      console.log("[WebRTC] Received offer from:", from);

      const pc = createPeerConnection(from, socket);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("webrtc-answer", {
          meetingId,
          answer: pc.localDescription,
          to: from,
        });
        console.log("[WebRTC] Answer sent to:", from);
      } catch (err) {
        console.error("[WebRTC] Error handling offer:", err);
      }
    },
    [createPeerConnection, meetingId],
  );

  // WebRTC helper: Handle incoming answer
  const handleAnswer = useCallback(async (data) => {
    const { answer, from } = data;
    console.log("[WebRTC] Received answer from:", from);

    const pc = peerConnectionsRef.current.get(from);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("[WebRTC] Remote description set for:", from);
      } catch (err) {
        console.error("[WebRTC] Error setting remote description:", err);
      }
    }
  }, []);

  // WebRTC helper: Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async (data) => {
    const { candidate, from } = data;
    console.log("[WebRTC] Received ICE candidate from:", from);

    const pc = peerConnectionsRef.current.get(from);
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("[WebRTC] ICE candidate added from:", from);
      } catch (err) {
        console.error("[WebRTC] Error adding ICE candidate:", err);
      }
    }
  }, []);

  // WebRTC helper: Close a specific peer connection
  const closePeerConnection = useCallback((userId) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
      setRemoteStreams((prev) => {
        const updated = new Map(prev);
        updated.delete(userId);
        return updated;
      });
      console.log("[WebRTC] Closed connection with:", userId);
    }
  }, []);

  // WebRTC helper: Close all peer connections
  const closeAllPeerConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((pc, userId) => {
      pc.close();
      console.log("[WebRTC] Closed connection with:", userId);
    });
    peerConnectionsRef.current.clear();
    setRemoteStreams(new Map());
  }, []);

  // Get user media on mount
  useEffect(() => {
    const initMedia = async () => {
      try {
        console.log("[WebRTC] Requesting user media...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        console.log("[WebRTC] Got local stream");

        // Disable tracks by default (mic and camera off)
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });

        setLocalStream(stream);
        localStreamRef.current = stream;
      } catch (err) {
        console.error("[WebRTC] Error getting user media:", err);
        // Try with just audio if video fails
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          // Disable audio by default
          audioStream.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
          setLocalStream(audioStream);
          localStreamRef.current = audioStream;
        } catch (audioErr) {
          console.error("[WebRTC] Error getting audio:", audioErr);
        }
      }
    };

    initMedia();

    // Cleanup on unmount
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      closeAllPeerConnections();
    };
  }, [closeAllPeerConnections]);

  // Fetch meeting data on mount
  useEffect(() => {
    const fetchMeeting = async () => {
      if (!meetingId) {
        navigate("/home");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await api.get(`/v2/meeting/${meetingId}`);
        if (response.data.success && response.data.meeting) {
          setMeeting(response.data.meeting);
          // Determine if current user is the host
          const hostId =
            response.data.meeting.hostId?._id || response.data.meeting.hostId;
          setIsHost(hostId === user?._id);
        } else {
          setError("Meeting not found");
          setTimeout(() => navigate("/home"), 2000);
        }
      } catch (err) {
        const message = err.response?.data?.message || "Failed to load meeting";
        if (err.response?.status === 404) {
          setError("Meeting not found");
          setTimeout(() => navigate("/home"), 2000);
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMeeting();
  }, [meetingId, navigate, user?._id]);

  // Socket connection and event handlers
  useEffect(() => {
    if (!meeting || !meetingId || !localStreamRef.current) return;

    let isMounted = true;

    // Connect socket
    const socket = connectSocket();

    // Event handlers
    const handleRoomJoined = (data) => {
      if (!isMounted) return;
      console.log("Room joined - Full data:", JSON.stringify(data, null, 2));
      console.log("Current user ID:", user?._id);
      console.log("Participants in room:", data.participants);
      // Set total participant count from room-joined (includes everyone)
      setTotalParticipants(data.participants?.length || 1);
      // Wait for offers from existing participants (they initiate)
    };

    const handleChatHistory = (history) => {
      if (!isMounted) return;
      console.log("Chat history received:", history);
      // Load last 50 messages
      const recentMessages = Array.isArray(history) ? history.slice(-100) : [];
      setMessages(recentMessages);
    };

    const handleReceiveMessage = (message) => {
      if (!isMounted) return;
      console.log("New message received:", message);
      setMessages((prev) => [...prev, message]);
    };

    const handleUserJoined = (data) => {
      if (!isMounted) return;
      console.log("User joined event received:", JSON.stringify(data, null, 2));
      setParticipants((prev) => {
        // Avoid duplicates - check by userId
        if (prev.some((p) => p.userId === data.userId)) {
          console.log("User already in participants, skipping");
          return prev;
        }
        console.log("Adding user to participants");
        return [...prev, data];
      });
      // Increment total count
      setTotalParticipants((prev) => prev + 1);

      // As existing participant, initiate WebRTC offer to new user
      if (localStreamRef.current) {
        console.log("[WebRTC] Initiating offer to new user:", data.userId);
        sendOffer(data.userId, socket);
      }
    };

    const handleUserLeft = (data) => {
      if (!isMounted) return;
      console.log("User left:", data);
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
      // Decrement total count
      setTotalParticipants((prev) => Math.max(1, prev - 1));
      // Close peer connection with leaving user
      closePeerConnection(data.userId);
    };

    // WebRTC event handlers
    const handleWebRTCOffer = (data) => {
      if (!isMounted) return;
      console.log("[WebRTC] Received offer event:", data.from);
      handleOffer(data, socket);
    };

    const handleWebRTCAnswer = (data) => {
      if (!isMounted) return;
      console.log("[WebRTC] Received answer event:", data.from);
      handleAnswer(data);
    };

    const handleWebRTCIceCandidate = (data) => {
      if (!isMounted) return;
      handleIceCandidate(data);
    };

    // Host control event handlers
    const handleUserRemoved = (data) => {
      if (!isMounted) return;
      console.log("User removed:", data);
      const { userId } = data;
      // Close peer connection with removed user
      closePeerConnection(userId);
      // Remove from participants list
      setParticipants((prev) => prev.filter((p) => p.userId !== userId));
      setTotalParticipants((prev) => Math.max(1, prev - 1));
    };

    const handleMeetingEnded = (data) => {
      if (!isMounted) return;
      console.log("Meeting ended:", data);
      // Close all peer connections
      closeAllPeerConnections();
      // Stop local media
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Navigate to home
      alert("The meeting has ended.");
      navigate("/home");
    };

    const handleRemovedFromMeeting = (data) => {
      if (!isMounted) return;
      console.log("Removed from meeting:", data);
      // Close all peer connections
      closeAllPeerConnections();
      // Stop local media
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Navigate to home with message
      alert(data.reason || "You have been removed from the meeting.");
      navigate("/home");
    };

    // Register event listeners
    socket.on("room-joined", handleRoomJoined);
    socket.on("chat-history", handleChatHistory);
    socket.on("receive-message", handleReceiveMessage);
    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);
    socket.on("webrtc-offer-received", handleWebRTCOffer);
    socket.on("webrtc-answer-received", handleWebRTCAnswer);
    socket.on("webrtc-ice-candidate-received", handleWebRTCIceCandidate);
    socket.on("user-removed", handleUserRemoved);
    socket.on("meeting-ended", handleMeetingEnded);
    socket.on("removed-from-meeting", handleRemovedFromMeeting);

    // Join the room only if not already connected
    if (!socket.hasJoinedRoom) {
      socket.emit("join-room", { meetingId });
      socket.hasJoinedRoom = true;
    }

    // Cleanup on unmount
    return () => {
      isMounted = false;
      socket.off("room-joined", handleRoomJoined);
      socket.off("chat-history", handleChatHistory);
      socket.off("receive-message", handleReceiveMessage);
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
      socket.off("webrtc-offer-received", handleWebRTCOffer);
      socket.off("webrtc-answer-received", handleWebRTCAnswer);
      socket.off("webrtc-ice-candidate-received", handleWebRTCIceCandidate);
      socket.off("user-removed", handleUserRemoved);
      socket.off("meeting-ended", handleMeetingEnded);
      socket.off("removed-from-meeting", handleRemovedFromMeeting);
      socket.hasJoinedRoom = false;
      closeAllPeerConnections();
      disconnectSocket();
    };
  }, [
    meeting,
    meetingId,
    user,
    localStream,
    sendOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    closePeerConnection,
    closeAllPeerConnections,
    navigate,
  ]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const socket = getSocket();
    if (socket) {
      socket.emit("send-message", { meetingId, content: chatInput.trim() });
      setChatInput("");
    }
  };

  const toggleChat = () => {
    setChatOpen((prev) => !prev);
  };

  // Toggle microphone mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  };

  // Toggle video on/off
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff((prev) => !prev);
    }
  };

  // Host control: Remove user from meeting
  const handleRemoveUser = (targetUserId, targetName) => {
    if (!isHost) return;
    if (window.confirm(`Remove ${targetName} from the meeting?`)) {
      const socket = getSocket();
      if (socket) {
        socket.emit("remove-user", { meetingId, targetUserId });
      }
    }
  };

  // Host control: End meeting for everyone
  const handleEndMeeting = () => {
    if (!isHost) return;
    if (
      window.confirm("Are you sure you want to end this meeting for everyone?")
    ) {
      const socket = getSocket();
      if (socket) {
        socket.emit("end-meeting", { meetingId });
      }
    }
  };

  const handleLeaveMeeting = () => {
    // Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    // Close all peer connections
    closeAllPeerConnections();
    disconnectSocket();
    navigate("/home");
  };

  const handleCopyMeetingId = async () => {
    try {
      await navigator.clipboard.writeText(meetingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="meeting-page">
        <div className="meeting-loading">
          <div className="spinner"></div>
          <p>Joining meeting...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="meeting-page">
        <div className="meeting-error">
          <p>{error}</p>
          <span>Redirecting to home...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-page">
      <header className="meeting-header">
        <div className="meeting-info">
          <span className="meeting-title">{meeting?.title || "Meeting"}</span>
          <span className="meeting-id">{meetingId}</span>
          <button
            className={`copy-btn ${copied ? "copied" : ""}`}
            onClick={handleCopyMeetingId}
            title="Copy Meeting ID"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied!" : "Copy ID"}
          </button>
          <span className="participants-count">
            {totalParticipants} participant
            {totalParticipants !== 1 ? "s" : ""}
          </span>
          {isHost && <span className="host-badge">Host</span>}
        </div>
        <button className="btn-leave" onClick={handleLeaveMeeting}>
          Leave Meeting
        </button>
      </header>

      <main className="meeting-main">
        <div className="video-grid">
          {/* Current user video */}
          <div className="video-container">
            {localStream && !isVideoOff ? (
              <video
                ref={(el) => {
                  localVideoRef.current = el;
                  if (el && el.srcObject !== localStream) {
                    el.srcObject = localStream;
                  }
                }}
                autoPlay
                muted
                playsInline
                className="video-element local-video"
              />
            ) : (
              <div className="user-avatar-large">
                {user?.name?.charAt(0) || "U"}
              </div>
            )}
            <span className="participant-name">
              {user?.name || "You"} (You)
              {isMuted && " 🔇 "}
            </span>
          </div>

          {/* Remote participants */}
          {participants
            .filter((p) => p.userId !== user?._id && p.name)
            .map((participant) => {
              const remoteStream = remoteStreams.get(participant.userId);
              return (
                <div key={participant.userId} className="video-container">
                  {remoteStream ? (
                    <video
                      autoPlay
                      playsInline
                      className="video-element"
                      ref={(el) => {
                        if (el && el.srcObject !== remoteStream) {
                          el.srcObject = remoteStream;
                        }
                      }}
                    />
                  ) : (
                    <div className="user-avatar-large">
                      {participant.name.charAt(0)}
                    </div>
                  )}
                  <span className="participant-name">{participant.name}</span>
                  {/* Host can remove participants */}
                  {isHost && (
                    <button
                      className="remove-participant-btn"
                      onClick={() =>
                        handleRemoveUser(participant.userId, participant.name)
                      }
                      title={`Remove ${participant.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </main>

      <footer className="meeting-controls">
        <button
          className={`control-btn ${isMuted ? "muted" : ""}`}
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOffIcon /> : <MicIcon />}
        </button>
        <button
          className={`control-btn ${isVideoOff ? "video-off" : ""}`}
          onClick={toggleVideo}
          title={isVideoOff ? "Turn on camera" : "Turn off camera"}
        >
          {isVideoOff ? <VideoOffIcon /> : <VideoIcon />}
        </button>
        <button
          className={`control-btn ${chatOpen ? "active" : ""}`}
          onClick={toggleChat}
          title="Chat"
        >
          <ChatIcon />
        </button>
        <button
          className="control-btn btn-end"
          onClick={handleLeaveMeeting}
          title="Leave Call"
        >
          <CallEndIcon />
        </button>
        {/* Host-only: End meeting for all */}
        {isHost && (
          <button
            className="btn-end-meeting"
            onClick={handleEndMeeting}
            title="End meeting for everyone"
          >
            End Meeting
          </button>
        )}
      </footer>

      {/* Chat Panel */}
      <div className={`chat-panel ${chatOpen ? "open" : ""}`}>
        <div className="chat-header">
          <h3>In-call messages</h3>
          <button className="chat-close-btn" onClick={toggleChat}>
            <CloseIcon />
          </button>
        </div>
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <p>No messages yet</p>
              <span>Messages are only visible to people in the call</span>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={msg._id || index}
                className={`chat-message ${msg.senderId === user?._id ? "own" : ""}`}
              >
                <div className="message-header">
                  <span className="message-sender">
                    {msg.senderId === user?._id ? "You" : msg.name}
                  </span>
                  <span className="message-time">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="message-content">{msg.content}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Send a message to everyone"
            className="chat-input"
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!chatInput.trim()}
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
};

export default MeetingPage;
