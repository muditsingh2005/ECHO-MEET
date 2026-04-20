import jwt from "jsonwebtoken";

/**
 * Verify JWT — identical logic to ECHO-MEET's verifyJWT middleware.
 * Accepts token from Authorization header (primary) or cookies (fallback).
 * Attaches { userId, email, name } to req.user on success.
 */
export const verifyJWT = (req, res, next) => {
  try {
    let token = null;

    // Primary: Authorization header (Bearer token)
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Fallback: cookies
    if (!token) {
      token = req.cookies?.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized — no token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized — token expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized — invalid token",
      });
    }

    console.error("[AI-SERVICE] JWT verification error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
