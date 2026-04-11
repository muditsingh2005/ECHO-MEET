import { User } from "../models/User.model.js";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Token Generators
// ---------------------------------------------------------------------------

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      name: user.name,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1h" },
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" },
  );
};

// ---------------------------------------------------------------------------
// Google OAuth Callback
// ---------------------------------------------------------------------------

export const googleCallback = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173";
      return res.redirect(`${frontendURL}/login?error=auth_failed`);
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Persist refresh token in DB for validation & rotation
    await User.findByIdAndUpdate(user._id, { refreshToken });

    // Redirect to frontend with tokens as URL params.
    // The frontend will extract, store in localStorage, and clean the URL.
    const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173/home";
    const redirectURL = new URL(frontendURL);
    redirectURL.searchParams.set("accessToken", accessToken);
    redirectURL.searchParams.set("refreshToken", refreshToken);

    res.redirect(redirectURL.toString());
  } catch (error) {
    console.error("Google callback error:", error);
    const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendURL}/login?error=server_error`);
  }
};

// ---------------------------------------------------------------------------
// Get Current User  (requires Authorization header)
// ---------------------------------------------------------------------------

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "-password -refreshToken -blacklistedTokens",
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Logout  (accepts refresh token from body or cookies)
// ---------------------------------------------------------------------------

export const logout = async (req, res) => {
  try {
    // Accept refresh token from request body (primary) or cookies (fallback)
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    if (refreshToken) {
      try {
        const decoded = jwt.verify(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET,
        );

        // Blacklist the refresh token and clear stored token
        await User.findByIdAndUpdate(decoded.userId, {
          refreshToken: null,
          $push: {
            blacklistedTokens: {
              token: refreshToken,
              blacklistedAt: new Date(),
            },
          },
        });
      } catch {
        // Token may be expired/invalid — still proceed with logout
      }
    }

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.json({ message: "Logged out successfully" });
  }
};

// ---------------------------------------------------------------------------
// Refresh Access Token  (accepts refresh token from body or cookies)
// ---------------------------------------------------------------------------

export const refreshAccessToken = async (req, res) => {
  try {
    // Accept refresh token from request body (primary) or cookies (fallback)
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token not provided" });
    }

    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }

    // Find user and validate token
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check if token matches stored token (prevents reuse of rotated tokens)
    if (user.refreshToken !== refreshToken) {
      return res
        .status(401)
        .json({ message: "Refresh token mismatch - possible token reuse" });
    }

    // Check if token is blacklisted
    const isBlacklisted = user.blacklistedTokens?.some(
      (item) => item.token === refreshToken,
    );

    if (isBlacklisted) {
      return res
        .status(401)
        .json({ message: "Refresh token has been revoked" });
    }

    // Generate new tokens (rotation for security)
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    await User.findByIdAndUpdate(user._id, { refreshToken: newRefreshToken });

    // Return tokens in response body (not cookies)
    res.json({
      message: "Token refreshed successfully",
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
