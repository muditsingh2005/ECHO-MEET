import { User } from "../models/User.model.js";
import jwt from "jsonwebtoken";

const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 1000, // 1 hour
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const googleCallback = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token in database
    await User.findByIdAndUpdate(user._id, { refreshToken });

    res.cookie("accessToken", accessToken, accessCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    res.redirect(process.env.FRONTEND_URL || "http://localhost:5173/dashboard");
  } catch (error) {
    console.error("Google callback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const generateAccessToken = (user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    name: user.name,
  };

  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1h",
  });
};

const generateRefreshToken = (user) => {
  const payload = {
    userId: user._id,
  };

  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  });
};

export const getCurrentUser = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = await User.findById(req.user.userId).select("-password -refreshToken -blacklistedTokens");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      // Decode token to get user ID
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      
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
    }

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    // Even if token verification fails, clear cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out successfully" });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token not provided" });
    }

    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    // Find user and validate token
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check if token matches stored token
    if (user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Refresh token mismatch - possible token reuse" });
    }

    // Check if token is blacklisted
    const isBlacklisted = user.blacklistedTokens?.some(
      (item) => item.token === refreshToken
    );

    if (isBlacklisted) {
      return res.status(401).json({ message: "Refresh token has been revoked" });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    // Optionally rotate refresh token for enhanced security
    const newRefreshToken = generateRefreshToken(user);
    await User.findByIdAndUpdate(user._id, { refreshToken: newRefreshToken });

    res.cookie("accessToken", newAccessToken, accessCookieOptions);
    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);

    res.json({ 
      message: "Token refreshed successfully",
      accessToken: newAccessToken // For clients that don't use cookies
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
