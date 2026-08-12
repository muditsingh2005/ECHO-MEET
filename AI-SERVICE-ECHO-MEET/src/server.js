import dotenv from "dotenv";
dotenv.config();

import { app } from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5300;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(
        `[AI-SERVICE] Running on port ${PORT} (${process.env.NODE_ENV || "development"})`,
      );
    });
  } catch (error) {
    console.error("[AI-SERVICE] Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
