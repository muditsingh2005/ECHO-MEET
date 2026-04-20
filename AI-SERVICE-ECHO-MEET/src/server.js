import dotenv from "dotenv";
dotenv.config();

import { app } from "./app.js";

const PORT = process.env.PORT || 5300;

app.listen(PORT, () => {
  console.log(`[AI-SERVICE] Running on port ${PORT} (${process.env.NODE_ENV || "development"})`);
});
