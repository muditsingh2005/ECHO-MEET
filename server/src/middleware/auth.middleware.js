import jwt from "jsonwebtoken";

export const verifyJWT = (req, res, next) => {
  try {
    // 🔍 DEBUG: Log what the server actually receives
    console.log("[AUTH DEBUG] verifyJWT called:", JSON.stringify({
      url: req.originalUrl,
      hasCookiesObj: !!req.cookies,
      cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
      hasAccessTokenCookie: !!req.cookies?.accessToken,
      hasAuthHeader: !!req.headers.authorization,
      origin: req.headers.origin || null,
      cookieHeader: req.headers.cookie ? req.headers.cookie.substring(0, 100) + "..." : "(no cookie header)",
    }));

    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
      console.log("[AUTH DEBUG] Using token from Authorization header");
    }

    if (!token) {
      console.log("[AUTH DEBUG] ❌ No token found in cookies or headers");
      return res.status(401).json({
        message: "Unauthorized - No token provided",
        isAuthenticated: false,
      });
    }

    console.log("[AUTH DEBUG] ✅ Token found, verifying...");
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("[AUTH DEBUG] ✅ Token verified for user:", decoded.email);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      console.log("[AUTH DEBUG] ❌ Token expired");
      return res.status(401).json({
        message: "Unauthorized - Token expired",
        isAuthenticated: false,
      });
    }

    if (error.name === "JsonWebTokenError") {
      console.log("[AUTH DEBUG] ❌ Invalid token:", error.message);
      return res.status(401).json({
        message: "Unauthorized - Invalid token",
        isAuthenticated: false,
      });
    }

    console.error("JWT verification error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const token = req.cookies?.accessToken;

    if (token) {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name,
      };
    }

    next();
  } catch (error) {
    next();
  }
};
