import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import aiRoutes from "./routes/ai.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./utils/logger.js";

const app = express();
app.set("trust proxy", 1);

const normalizeOrigin = (value) => value?.trim().replace(/\/$/, "");

const envOrigins = [
  ...(process.env.CORS_ORIGINS || "").split(","),
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
]
  .map(normalizeOrigin)
  .filter(Boolean);

const defaultOrigins = ["https://echo-meet-client.vercel.app"].map(
  normalizeOrigin,
);

const allowedOrigins = Array.from(
  new Set(
    process.env.NODE_ENV === "production"
      ? envOrigins.length
        ? envOrigins
        : defaultOrigins
      : [...defaultOrigins, ...envOrigins],
  ),
);

console.log("[AI-CORS] allowed origins:", allowedOrigins);

app.use(
  cors({
    origin(origin, cb) {
      const normalizedOrigin = normalizeOrigin(origin);

      if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
        return cb(null, true);
      }

      console.warn("[AI-CORS] blocked origin:", normalizedOrigin);
      cb(new Error(`Not allowed by CORS: ${normalizedOrigin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(cookieParser());

// Rate limiting — protect Groq API quota
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ai-service-echo-meet" });
});

app.use("/api/v1/ai", aiLimiter, aiRoutes);

app.use((_req, res) => {
  logger.warn(`[NOT_FOUND] ${_req.method} ${_req.path}`);
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    errorCode: "NOT_FOUND",
  });
});

app.use(errorHandler);

export { app };
