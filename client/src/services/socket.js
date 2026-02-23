import { io } from "socket.io-client";

let socket = null;

export const connectSocket = () => {
  // Return existing connected socket
  if (socket?.connected) {
    return socket;
  }

  // Clean up existing disconnected socket
  if (socket) {
    socket.removeAllListeners();
    socket = null;
  }

  // Create new socket instance
  socket = io(import.meta.env.VITE_SOCKET_URL, {
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Connection successful
  socket.on("connect", () => {
    console.log("[Socket] Connected:", socket.id);
  });

  // Connection error
  socket.on("connect_error", (error) => {
    console.error("[Socket] Connection error:", error.message);
  });

  // Disconnection
  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
  });

  // Reconnection attempt
  socket.on("reconnect_attempt", (attemptNumber) => {
    console.log("[Socket] Reconnection attempt:", attemptNumber);
  });

  // Reconnection successful
  socket.on("reconnect", (attemptNumber) => {
    console.log("[Socket] Reconnected after", attemptNumber, "attempts");
  });

  // Reconnection failed after all attempts
  socket.on("reconnect_failed", () => {
    console.error("[Socket] Reconnection failed after maximum attempts");
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    console.log("[Socket] Disconnected and cleaned up");
  }
};

export const isSocketConnected = () => socket?.connected ?? false;
