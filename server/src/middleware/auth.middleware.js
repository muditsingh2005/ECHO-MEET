import jwt from "jsonwebtoken";

export const verifyJWT = (req, res, next) => {
  try {

    const token = req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized - No token provided",
        isAuthenticated: false,
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
        message: "Unauthorized - Token expired",
        isAuthenticated: false,
      });
    }

    if (error.name === "JsonWebTokenError") {
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
