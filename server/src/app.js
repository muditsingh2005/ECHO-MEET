import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import passport from "./config/passport.js";
import authRoutes from "./routes/auth.routes.js";
import meetingRoutes from "./routes/meeting.routes.js";

const app = express();
app.set("trust proxy", 1);

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [process.env.CORS_ORIGIN].filter(Boolean)
    : [
        process.env.CORS_ORIGIN,
        "http://localhost:5173",
        "http://localhost:3000",
      ].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    console.log(
      "[CORS] origin check:",
      JSON.stringify({
        origin,
        nodeEnv: process.env.NODE_ENV,
      }),
    );

    if (!origin && process.env.NODE_ENV !== "production") {
      console.log("[CORS] decision: allow (no origin in non-production)");
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log("[CORS] decision: allow (origin matched)");
      callback(null, true);
    } else {
      console.log(
        "[CORS] decision: deny (origin not in allowlist)",
        JSON.stringify({ allowedOrigins }),
      );
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["set-cookie"],
  maxAge: 86400, // 24 hours preflight cache
};

app.use((req, res, next) => {
  console.log(
    "[REQ] incoming:",
    JSON.stringify({
      method: req.method,
      originalUrl: req.originalUrl,
      origin: req.headers.origin || null,
      host: req.headers.host || null,
      nodeEnv: process.env.NODE_ENV,
      allowedOrigins,
    }),
  );
  next();
});

app.use(cors(corsOptions));

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // max: 20, // Limit each IP to 40 requests per window
  message: {
    error:
      "Too many authentication attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

const meetingCreateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each IP to 30 meeting creations per hour
  message: {
    error: "Too many meetings created, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiter to all routes
app.use(generalRateLimiter);

app.use(passport.initialize());

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Apply stricter rate limiting to auth routes
app.use("/api/v1/auth", authRateLimiter, authRoutes);

// Apply meeting create rate limiter specifically to meeting creation
// app.use("/api/v2/meeting/create", meetingCreateRateLimiter);
app.use("/api/v2/meeting", meetingCreateRateLimiter, meetingRoutes);

app.use((err, req, res, next) => {
  console.error(
    "[ERROR] Express error:",
    JSON.stringify({
      message: err?.message,
      originalUrl: req?.originalUrl,
    }),
  );
  console.error(err?.stack);

  if (process.env.NODE_ENV !== "production") {
    return res.status(500).json({
      error: err?.message || "Internal server error",
      stack: err?.stack,
      path: req?.originalUrl,
    });
  }

  return res.status(500).json({ error: "Internal server error" });
});

export { app };
