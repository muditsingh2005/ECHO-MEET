import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import aiRoutes from "./routes/ai.routes.js";

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

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
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
  message: { success: false, error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ai-service-echo-meet" });
});

app.use("/api/v1/ai", aiLimiter, aiRoutes);

app.use((err, _req, res, _next) => {
  console.error("[AI-SERVICE ERROR]", err.message);

  if (process.env.NODE_ENV !== "production") {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
  return res.status(500).json({ error: "Internal server error" });
});

export { app };
