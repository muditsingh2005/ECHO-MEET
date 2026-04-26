/**
 * Transcript Assembly Service
 *
 * Takes raw chunk-level transcript entries from a session and produces
 * a clean, speaker-grouped, chronologically ordered final transcript.
 *
 * Input shape (from session.service):
 *   { userId: string, name: string, text: string, timestamp: Date }[]
 *
 * Output shape:
 *   {
 *     segments:       { speaker, text, startTime, endTime }[],
 *     fullText:       string,
 *     speakerStats:   { userId, name, wordCount, speakingTime }[],
 *     duration:       { start, end, totalMs },
 *   }
 */

// ─── Main Assembly ──────────────────────────────────────────────

/**
 * Assemble raw transcript chunks into a clean meeting transcript.
 *
 * @param {Array<{ userId: string, name: string, text: string, timestamp: Date|string }>} rawEntries
 * @returns {{ segments, fullText, speakerStats, duration }}
 */
export function assembleTranscript(rawEntries) {
  if (!rawEntries || rawEntries.length === 0) {
    return {
      segments: [],
      fullText: "",
      speakerStats: [],
      duration: null,
    };
  }

  // 1. Normalize timestamps and sort chronologically
  const sorted = rawEntries
    .map((e) => ({
      ...e,
      timestamp: new Date(e.timestamp),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // 2. Deduplicate fragments
  const deduped = _deduplicateEntries(sorted);

  // 3. Merge consecutive entries from the same speaker
  const segments = _mergeConsecutiveSpeaker(deduped);

  // 4. Build the full plain-text transcript
  const fullText = _buildFullText(segments);

  // 5. Compute per-speaker stats
  const speakerStats = _computeSpeakerStats(segments);

  // 6. Compute duration
  const firstTs = sorted[0].timestamp;
  const lastTs = sorted[sorted.length - 1].timestamp;
  const duration = {
    start: firstTs.toISOString(),
    end: lastTs.toISOString(),
    totalMs: lastTs - firstTs,
  };

  return { segments, fullText, speakerStats, duration };
}

// ─── Deduplication ──────────────────────────────────────────────

/**
 * Remove duplicate or near-duplicate transcript entries.
 *
 * Whisper can produce overlapping chunks that result in the same text
 * appearing multiple times in sequence. This handles:
 *   - Exact duplicates (same speaker, same text, close in time)
 *   - Substring fragments (one entry is a prefix/suffix of the next)
 */
function _deduplicateEntries(entries) {
  if (entries.length <= 1) return entries;

  const result = [entries[0]];

  for (let i = 1; i < entries.length; i++) {
    const prev = result[result.length - 1];
    const curr = entries[i];

    const prevText = _normalize(prev.text);
    const currText = _normalize(curr.text);

    // Skip exact duplicates from the same speaker within 5 seconds
    if (
      prev.userId === curr.userId &&
      prevText === currText &&
      Math.abs(curr.timestamp - prev.timestamp) < 5000
    ) {
      continue;
    }

    // Skip if current text is a substring of the previous (fragment overlap)
    if (prev.userId === curr.userId && prevText.includes(currText)) {
      continue;
    }

    // If previous text is a prefix of the current, replace prev with current
    // (the current entry is a more complete version)
    if (
      prev.userId === curr.userId &&
      currText.startsWith(prevText) &&
      Math.abs(curr.timestamp - prev.timestamp) < 5000
    ) {
      result[result.length - 1] = curr;
      continue;
    }

    // Remove overlapping tail/head between consecutive same-speaker entries
    if (prev.userId === curr.userId) {
      const trimmed = _removeOverlap(prev.text, curr.text);
      if (trimmed !== curr.text) {
        curr.text = trimmed;
      }
    }

    // Skip if after trimming, nothing meaningful remains
    if (_normalize(curr.text).length <= 2) {
      continue;
    }

    result.push(curr);
  }

  return result;
}

// ─── Speaker Merging ────────────────────────────────────────────

/**
 * Merge consecutive transcript entries from the same speaker
 * into unified segments.
 *
 * A new segment is started when:
 *   - The speaker changes
 *   - There's a gap of > 30 seconds between entries (natural pause)
 */
const PAUSE_THRESHOLD_MS = 30_000;

function _mergeConsecutiveSpeaker(entries) {
  if (entries.length === 0) return [];

  const segments = [];
  let current = {
    userId: entries[0].userId,
    speaker: entries[0].name,
    text: entries[0].text,
    startTime: entries[0].timestamp.toISOString(),
    endTime: entries[0].timestamp.toISOString(),
  };

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    const timeSincePrev =
      entry.timestamp - new Date(current.endTime);
    const sameSpeaker = entry.userId === current.userId;

    if (sameSpeaker && timeSincePrev < PAUSE_THRESHOLD_MS) {
      // Append to current segment
      current.text = _joinSentences(current.text, entry.text);
      current.endTime = entry.timestamp.toISOString();
    } else {
      // Finalize current segment, start new one
      segments.push({ ...current });
      current = {
        userId: entry.userId,
        speaker: entry.name,
        text: entry.text,
        startTime: entry.timestamp.toISOString(),
        endTime: entry.timestamp.toISOString(),
      };
    }
  }

  // Push the last segment
  segments.push({ ...current });

  return segments;
}

// ─── Full Text ──────────────────────────────────────────────────

/**
 * Build a readable plain-text transcript from segments.
 */
function _buildFullText(segments) {
  return segments
    .map((seg) => `${seg.speaker}: ${seg.text}`)
    .join("\n\n");
}

// ─── Speaker Stats ──────────────────────────────────────────────

/**
 * Compute per-speaker word count and speaking time.
 */
function _computeSpeakerStats(segments) {
  const statsMap = new Map();

  for (const seg of segments) {
    if (!statsMap.has(seg.userId)) {
      statsMap.set(seg.userId, {
        userId: seg.userId,
        name: seg.speaker,
        wordCount: 0,
        segmentCount: 0,
        speakingTimeMs: 0,
      });
    }

    const stat = statsMap.get(seg.userId);
    const words = seg.text.split(/\s+/).filter(Boolean).length;
    const durationMs =
      new Date(seg.endTime) - new Date(seg.startTime);

    stat.wordCount += words;
    stat.segmentCount += 1;
    stat.speakingTimeMs += Math.max(durationMs, 0);
  }

  return Array.from(statsMap.values()).sort(
    (a, b) => b.wordCount - a.wordCount,
  );
}

// ─── String Helpers ─────────────────────────────────────────────

/**
 * Normalize text for comparison (lowercase, collapse whitespace, trim punctuation).
 */
function _normalize(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Join two sentences with proper spacing and punctuation.
 */
function _joinSentences(a, b) {
  const trimmedA = a.trimEnd();
  const trimmedB = b.trimStart();

  // If A already ends with sentence-ending punctuation, just space-join
  if (/[.!?]$/.test(trimmedA)) {
    return `${trimmedA} ${trimmedB}`;
  }

  // If B starts with a lowercase letter, it's likely a continuation
  if (/^[a-z]/.test(trimmedB)) {
    return `${trimmedA} ${trimmedB}`;
  }

  // Otherwise add a period to separate
  return `${trimmedA}. ${trimmedB}`;
}

/**
 * Remove overlapping text between the tail of `prev` and head of `curr`.
 *
 * Example:
 *   prev = "so we need to think about"
 *   curr = "to think about the next steps"
 *   → returns "the next steps"
 */
function _removeOverlap(prev, curr) {
  const prevWords = prev.trim().split(/\s+/);
  const currWords = curr.trim().split(/\s+/);

  // Check for overlapping word sequences (up to 8 words)
  const maxCheck = Math.min(8, prevWords.length, currWords.length);

  for (let overlapLen = maxCheck; overlapLen >= 2; overlapLen--) {
    const prevTail = prevWords
      .slice(-overlapLen)
      .join(" ")
      .toLowerCase();
    const currHead = currWords
      .slice(0, overlapLen)
      .join(" ")
      .toLowerCase();

    if (prevTail === currHead) {
      // Remove the overlapping head from curr
      return currWords.slice(overlapLen).join(" ");
    }
  }

  return curr;
}
