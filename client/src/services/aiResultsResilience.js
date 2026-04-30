const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

const isObject = (value) => value !== null && typeof value === "object";
const asArray = (value) => (Array.isArray(value) ? value : []);
const asString = (value, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

export const hasTranscriptData = (transcript) => {
  if (!isObject(transcript)) return false;

  const fullText = asString(transcript.fullText);
  const segments = asArray(transcript.segments).filter((segment) =>
    asString(segment?.text),
  );

  return fullText.length > 0 || segments.length > 0;
};

export const hasSummaryData = (summary) => {
  if (!isObject(summary)) return false;

  return (
    asString(summary.title).length > 0 ||
    asString(summary.overview).length > 0 ||
    asArray(summary.keyPoints).length > 0 ||
    asArray(summary.actionItems).length > 0 ||
    asArray(summary.decisions).length > 0 ||
    asArray(summary.topics).length > 0
  );
};

export const sanitizeTranscript = (transcript) => {
  if (!isObject(transcript)) return null;

  const segments = asArray(transcript.segments)
    .map((segment) => {
      if (!isObject(segment)) return null;

      const text = asString(segment.text);
      if (!text) return null;

      return {
        speaker: asString(segment.speaker, "Speaker"),
        startTime: asString(segment.startTime),
        endTime: asString(segment.endTime),
        text,
      };
    })
    .filter(Boolean);

  const speakerStats = asArray(transcript.speakerStats)
    .map((stat) => {
      if (!isObject(stat)) return null;

      const wordCount = Number.isFinite(stat.wordCount) ? stat.wordCount : 0;
      const segmentCount = Number.isFinite(stat.segmentCount)
        ? stat.segmentCount
        : 0;

      return {
        name: asString(stat.name, "Speaker"),
        wordCount,
        segmentCount,
      };
    })
    .filter(Boolean);

  return {
    fullText: asString(transcript.fullText),
    segments,
    speakerStats,
    duration: {
      totalMs:
        Number.isFinite(transcript?.duration?.totalMs) &&
        transcript.duration.totalMs > 0
          ? transcript.duration.totalMs
          : 0,
    },
  };
};

export const sanitizeMeetingSummary = (summary) => {
  if (!isObject(summary)) return null;

  const keyPoints = asArray(summary.keyPoints)
    .map((point) => asString(point))
    .filter(Boolean);

  const decisions = asArray(summary.decisions)
    .map((decision) => asString(decision))
    .filter(Boolean);

  const topics = asArray(summary.topics)
    .map((topic) => asString(topic))
    .filter(Boolean);

  const actionItems = asArray(summary.actionItems)
    .map((item) => {
      if (!isObject(item)) return null;

      const task = asString(item.task);
      if (!task) return null;

      const rawPriority = asString(item.priority, "medium").toLowerCase();
      const priority = ALLOWED_PRIORITIES.has(rawPriority)
        ? rawPriority
        : "medium";

      return {
        task,
        assignee: asString(item.assignee, "Unassigned"),
        priority,
      };
    })
    .filter(Boolean);

  return {
    title: asString(summary.title, "Meeting Summary"),
    overview: asString(summary.overview),
    keyPoints,
    actionItems,
    decisions,
    topics,
  };
};

export const sanitizeSessionSummary = (sessionSummary) => {
  if (!isObject(sessionSummary)) return null;

  return {
    roomId: asString(sessionSummary.roomId),
    hostId: asString(sessionSummary.hostId),
    createdAt: asString(sessionSummary.createdAt),
    endedAt: asString(sessionSummary.endedAt),
    users: asArray(sessionSummary.users).filter(Boolean),
    durationMs:
      Number.isFinite(sessionSummary.durationMs) &&
      sessionSummary.durationMs > 0
        ? sessionSummary.durationMs
        : 0,
    totalAudioChunks:
      Number.isFinite(sessionSummary.totalAudioChunks) &&
      sessionSummary.totalAudioChunks > 0
        ? sessionSummary.totalAudioChunks
        : 0,
    totalAudioBytes:
      Number.isFinite(sessionSummary.totalAudioBytes) &&
      sessionSummary.totalAudioBytes > 0
        ? sessionSummary.totalAudioBytes
        : 0,
  };
};

export const normalizeAIResultsPayload = (payload) => {
  const source =
    isObject(payload?.data) &&
    (payload.data.transcript ||
      payload.data.meetingSummary ||
      payload.data.summary)
      ? payload.data
      : payload;

  if (!isObject(source)) {
    return {
      transcript: null,
      meetingSummary: null,
      summary: null,
      phases: null,
      hasTranscript: false,
      hasSummary: false,
    };
  }

  const transcript = sanitizeTranscript(source.transcript);
  const meetingSummary = sanitizeMeetingSummary(source.meetingSummary);
  const summary = sanitizeSessionSummary(source.summary);

  return {
    transcript,
    meetingSummary,
    summary,
    phases: isObject(source.phases) ? source.phases : null,
    hasTranscript: hasTranscriptData(transcript),
    hasSummary: hasSummaryData(meetingSummary),
  };
};
