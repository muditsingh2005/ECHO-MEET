import jwt from "jsonwebtoken";


export const socketAuthMiddleware = async (socket, next) => {
  try {
    let token = null;

    // Primary: handshake auth object (sent by client via socket.io auth option)
    if (socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    // Fallback: cookies (for local development)
    if (!token && socket.handshake.headers.cookie) {
      const { parse } = await import("cookie");
      const parsedCookies = parse(socket.handshake.headers.cookie);
      token = parsedCookies.accessToken;
    }

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    // Verify JWT
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });

    // Attach user to socket
    socket.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new Error("Authentication error: Token expired"));
    }

    if (error.name === "JsonWebTokenError") {
      return next(new Error("Authentication error: Invalid token"));
    }

    console.error("Socket authentication error:", error);
    return next(new Error("Authentication error: Connection rejected"));
  }
};
