import { User } from "../models/User.model.js";
import jwt from "jsonwebtoken";

// Cookie options for JWT token
const cookieOptions = {
  httpOnly: true, // Prevents XSS attacks - JS can't access cookie
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "lax", // CSRF protection
  maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
};

/**
 * Google OAuth callback handler
 * Called after successful Google authentication
 */
export const googleCallback = async (req, res) => {
  try {
    // User is attached by passport after successful authentication
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    // Generate JWT access token
    const accessToken = generateAccessToken(user);

    // Set JWT in HttpOnly cookie
    res.cookie("accessToken", accessToken, cookieOptions);

    // Redirect to frontend dashboard (adjust URL as needed)
    res.redirect(process.env.FRONTEND_URL || "http://localhost:5173/dashboard");
  } catch (error) {
    console.error("Google callback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Generate JWT access token
 * @param {Object} user - User document from MongoDB
 * @returns {string} JWT token
 */
const generateAccessToken = (user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    name: user.name,
  };

  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Logout - clear JWT cookie
 */
export const logout = (req, res) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  res.json({ message: "Logged out successfully" });
};
