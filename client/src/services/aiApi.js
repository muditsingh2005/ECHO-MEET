import axios from "axios";
import { TokenStorage } from "./api";

/**
 * AI Service API client.
 * Talks to the AI-SERVICE-ECHO-MEET backend.
 */

const AI_BASE_URL =
  import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:5300";

const aiApi = axios.create({
  baseURL: `${AI_BASE_URL}/api/v1/ai`,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT from localStorage on every request
aiApi.interceptors.request.use((config) => {
  const token = TokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Fetch the transcript for a currently active session.
 */
export const getSessionTranscript = async (roomId) => {
  const res = await aiApi.get(`/transcript/${roomId}`);
  return res.data;
};

/**
 * End a session and get the full response (transcript + summary).
 */
export const endAISession = async (roomId) => {
  const res = await aiApi.post("/end-session", { roomId });
  return res.data;
};

/**
 * On-demand summarization of any transcript text.
 */
export const summarizeTranscript = async (transcript) => {
  const res = await aiApi.post("/summarize", { transcript });
  return res.data;
};

export default aiApi;
