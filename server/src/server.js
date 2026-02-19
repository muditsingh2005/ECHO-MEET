import http from "http";
import { Server } from "socket.io";
import { app } from "./app.js";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { socketAuthMiddleware } from "./middleware/socket.auth.middleware.js";
import { registerRoomHandlers } from "./sockets/room.handler.js";

dotenv.config({
  path: "../.env",
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.use(socketAuthMiddleware);

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.user.userId}`);
  
  registerRoomHandlers(socket, io);
});

connectDB()
  .then(() => {
    httpServer.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running on port ${process.env.PORT || 8000}`);
    });
  })
  .catch((err) => {
    console.log("MongoDB connection error : ", err);
  });

export { io };
