/**
 * Meeting Summarization Service — Groq Llama 3.3 70B
 *
 * Takes an assembled meeting transcript and generates a structured summary
 * with key points, action items, and decisions made.
 *
 * Handles long transcripts by chunking into segments that fit the model's
 * context window, summarizing each chunk, then merging into a final summary.
 */

import {
  groqWithRetry,
  validateGroqCompletion,
  parseGroqJSON,
} from "../utils/groqResilience.js";
import { GroqError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// ─── Groq Client (shared lazy-init pattern) ─────────────────────

let _groqClient = null;

async function getGroqClient() {
  if (!_groqClient) {
    const { default: Groq } = await import("groq-sdk");
    _groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groqClient;
}

const MODEL = "llama-3.3-70b-versatile";

// ~4 chars per token (conservative). Llama 3.3 70B has 128K context,
// but we aim for ~12K tokens of transcript per chunk to leave room
// for the system prompt + response.
const MAX_CHARS_PER_CHUNK = 48_000;

// ─── System Prompts ─────────────────────────────────────────────

const SUMMARIZE_PROMPT = `You are a meeting summarization assistant. You will receive a meeting transcript and must produce a structured JSON summary.

Analyze the transcript carefully and return ONLY a valid JSON object with this exact structure:
{
  "title": "A concise meeting title (infer from context)",
  "overview": "A 2-3 sentence high-level summary of the meeting",
  "keyPoints": [
    "Key point 1",
    "Key point 2"
  ],
  "actionItems": [
    {
      "task": "Description of the action item",
      "assignee": "Person responsible (or 'Unassigned' if unclear)",
      "priority": "high | medium | low"
    }
  ],
  "decisions": [
    "Decision 1",
    "Decision 2"
  ],
  "topics": ["topic1", "topic2"]
}

Rules:
- Return ONLY the JSON object, no markdown fencing, no explanation
- If no action items or decisions are found, use empty arrays
- Infer assignees from speaker names when possible
- Keep key points concise (one sentence each)
- Prioritize action items based on urgency cues in the conversation`;

const MERGE_PROMPT = `You are a meeting summarization assistant. You will receive multiple partial summaries from different segments of the same meeting. Merge them into a single coherent summary.

Rules:
- Combine and deduplicate key points across segments
- Merge action items, removing duplicates
- Merge decisions, removing duplicates
- Write a unified overview that covers the entire meeting
- Return ONLY a valid JSON object with the same structure:
{
  "title": "...",
  "overview": "...",
  "keyPoints": [...],
  "actionItems": [{ "task": "...", "assignee": "...", "priority": "..." }],
  "decisions": [...],
  "topics": [...]
}`;

// ─── Main Entry Point ───────────────────────────────────────────

/**
 * Summarize a meeting transcript.
 *
 * @param {string} fullText — the assembled transcript text (Speaker: text format)
 * @param {{ segments?: Array, speakerStats?: Array }} [meta] — optional metadata
 * @returns {Promise<{ success: boolean, summary?: object, error?: string }>}
 */
export async function summarizeMeeting(fullText, meta = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new GroqError("GROQ_API_KEY not configured", null, 500, "GROQ_AUTH");
  }

  if (!fullText || fullText.trim().length === 0) {
    return {
      success: true,
      summary: _emptySummary(),
    };
  }

  try {
    if (fullText.length <= MAX_CHARS_PER_CHUNK) {
      logger.info("[SUMMARIZE] Single-chunk summarization", {
        textLength: fullText.length,
      });
      const summary = await _summarizeChunk(fullText);
      return { success: true, summary };
    }

    logger.info("[SUMMARIZE] Multi-chunk summarization", {
      textLength: fullText.length,
      maxCharsPerChunk: MAX_CHARS_PER_CHUNK,
    });

    const chunks = _chunkTranscript(fullText, MAX_CHARS_PER_CHUNK);
    logger.info("[SUMMARIZE] Transcript chunked", {
      chunkCount: chunks.length,
    });

    const partialSummaries = [];
    for (let i = 0; i < chunks.length; i++) {
      logger.debug("[SUMMARIZE] Summarizing chunk", {
        chunkIndex: i + 1,
        totalChunks: chunks.length,
        chunkSize: chunks[i].length,
      });
      const partial = await _summarizeChunk(chunks[i]);
      partialSummaries.push(partial);
    }

    logger.info("[SUMMARIZE] All chunks summarized, merging", {
      partialSummaryCount: partialSummaries.length,
    });

    const merged = await _mergeSummaries(partialSummaries);
    return { success: true, summary: merged };
  } catch (error) {
    if (error instanceof GroqError) {
      logger.error("[SUMMARIZE] Groq error", error, {
        groqErrorCode: error.groqErrorCode,
      });
      throw error;
    }

    logger.error("[SUMMARIZE] Unexpected error", error);
    throw new GroqError(
      error.message || "Summarization failed",
      error,
      500,
      "GROQ_ERROR",
    );
  }
}

// ─── Core LLM Calls ─────────────────────────────────────────────

/**
 * Summarize a single transcript chunk via Groq.
 */
async function _summarizeChunk(transcriptText) {
  const groq = await getGroqClient();

  return await groqWithRetry(
    "summarize_chunk",
    () =>
      groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: SUMMARIZE_PROMPT },
          {
            role: "user",
            content: `Here is the meeting transcript:\n\n${transcriptText}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    { maxRetries: 3, timeoutMs: 90000 },
  ).then((completion) => {
    const content = validateGroqCompletion(completion);
    const parsed = parseGroqJSON(content);
    return _validateSummary(parsed);
  });
}

/**
 * Merge multiple partial summaries into a final summary.
 */
async function _mergeSummaries(partialSummaries) {
  if (partialSummaries.length === 1) return partialSummaries[0];

  const groq = await getGroqClient();

  const mergeInput = partialSummaries
    .map((s, i) => `--- Segment ${i + 1} ---\n${JSON.stringify(s, null, 2)}`)
    .join("\n\n");

  try {
    return await groqWithRetry(
      "merge_summaries",
      () =>
        groq.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: MERGE_PROMPT },
            {
              role: "user",
              content: `Here are the partial summaries to merge:\n\n${mergeInput}`,
            },
          ],
          temperature: 0.2,
          max_tokens: 4096,
          response_format: { type: "json_object" },
        }),
      { maxRetries: 3, timeoutMs: 90000 },
    ).then((completion) => {
      const content = validateGroqCompletion(completion);
      const parsed = parseGroqJSON(content);
      return _validateSummary(parsed);
    });
  } catch (mergeError) {
    logger.warn("[SUMMARIZE] Merge failed, using manual fallback", {
      error: mergeError.message,
    });
    return _manualMerge(partialSummaries);
  }
}

// ─── Chunking ───────────────────────────────────────────────────

/**
 * Split transcript into chunks, breaking at speaker boundaries.
 */
function _chunkTranscript(text, maxChars) {
  // Split by speaker segments (double newline separated)
  const segments = text.split(/\n\n+/);
  const chunks = [];
  let current = "";

  for (const segment of segments) {
    // If adding this segment exceeds the limit, start a new chunk
    if (current.length + segment.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += (current ? "\n\n" : "") + segment;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // Safety: if a single segment is too large, force-split it
  return chunks.flatMap((chunk) =>
    chunk.length > maxChars ? _forceSplit(chunk, maxChars) : [chunk],
  );
}

/**
 * Force-split a single oversized text block at sentence boundaries.
 */
function _forceSplit(text, maxChars) {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const result = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.length > 0) {
      result.push(current.trim());
      current = "";
    }
    current += sentence;
  }

  if (current.trim()) result.push(current.trim());
  return result;
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Parse JSON from LLM output, handling common formatting issues.
 */
function _parseJSON(text) {
  let cleaned = text.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  return JSON.parse(cleaned);
}

/**
 * Ensure the summary has all expected fields with correct types.
 */
function _validateSummary(obj) {
  return {
    title: typeof obj.title === "string" ? obj.title : "Meeting Summary",
    overview: typeof obj.overview === "string" ? obj.overview : "",
    keyPoints: Array.isArray(obj.keyPoints) ? obj.keyPoints : [],
    actionItems: Array.isArray(obj.actionItems)
      ? obj.actionItems.map((item) => ({
          task: item.task || item.description || "",
          assignee: item.assignee || "Unassigned",
          priority: ["high", "medium", "low"].includes(item.priority)
            ? item.priority
            : "medium",
        }))
      : [],
    decisions: Array.isArray(obj.decisions) ? obj.decisions : [],
    topics: Array.isArray(obj.topics) ? obj.topics : [],
  };
}

/* Return an empty summary structure.
 */
function _emptySummary() {
  return {
    title: "Empty Meeting",
    overview: "No transcript content was available to summarize.",
    keyPoints: [],
    actionItems: [],
    decisions: [],
    topics: [],
  };
}

/**
 * Manual merge fallback when the LLM merge call fails.
 */
function _manualMerge(summaries) {
  const allKeyPoints = [...new Set(summaries.flatMap((s) => s.keyPoints))];
  const allDecisions = [...new Set(summaries.flatMap((s) => s.decisions))];
  const allTopics = [...new Set(summaries.flatMap((s) => s.topics))];

  // Dedupe action items by task text
  const seenTasks = new Set();
  const allActions = summaries
    .flatMap((s) => s.actionItems)
    .filter((a) => {
      const key = a.task.toLowerCase().trim();
      if (seenTasks.has(key)) return false;
      seenTasks.add(key);
      return true;
    });

  return {
    title: summaries[0]?.title || "Meeting Summary",
    overview: summaries
      .map((s) => s.overview)
      .filter(Boolean)
      .join(" "),
    keyPoints: allKeyPoints,
    actionItems: allActions,
    decisions: allDecisions,
    topics: allTopics,
  };
}

/**
 * Check if an error should NOT be retried.
 */
function _isNonRetryable(error) {
  const status = error?.status;
  return status >= 400 && status < 500 && status !== 429;
}
