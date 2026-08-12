import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getSessionTranscript, summarizeTranscript } from "../services/aiApi";
import {
  hasSummaryData,
  hasTranscriptData,
  normalizeAIResultsPayload,
} from "../services/aiResultsResilience";
import "./MeetingResultsPage.css";

// ─── Icons ──────────────────────────────────────────────────────

const ArrowLeftIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ClipboardIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const DownloadIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SummaryIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const TranscriptIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const StatsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const KeyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ActionIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const DecisionIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const TagIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const VIEW_STATES = {
  SUCCESS: "success",
  PARTIAL: "partial",
  EMPTY: "empty",
  ERROR: "error",
};

// ─── Component ──────────────────────────────────────────────────

const MeetingResultsPage = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState("summary");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState(VIEW_STATES.SUCCESS);
  const [error, setError] = useState("");
  const [notices, setNotices] = useState([]);

  const [resultData, setResultData] = useState({
    transcript: null,
    meetingSummary: null,
    summary: null,
    phases: null,
  });

  useEffect(() => {
    let cancelled = false;

    const initializeResults = async () => {
      setLoading(true);
      setError("");
      setNotices([]);

      const stateData = location.state?.aiResults;
      const normalizedState = normalizeAIResultsPayload(stateData);

      let nextData = {
        transcript: normalizedState.transcript,
        meetingSummary: normalizedState.meetingSummary,
        summary: normalizedState.summary,
        phases: normalizedState.phases,
      };

      let hasTranscript = normalizedState.hasTranscript;
      let hasSummary = normalizedState.hasSummary;
      let serviceUnavailable = false;
      const nextNotices = [];

      if (stateData?.fetchErrorMessage) {
        nextNotices.push(stateData.fetchErrorMessage);
      }

      if (!hasTranscript && meetingId) {
        try {
          const transcriptResponse = await getSessionTranscript(meetingId);
          const recovered = normalizeAIResultsPayload(transcriptResponse);

          if (recovered.hasTranscript) {
            nextData = { ...nextData, transcript: recovered.transcript };
            hasTranscript = true;
          } else {
            nextNotices.push("Transcript not available.");
          }
        } catch (err) {
          nextNotices.push("Transcript not available.");
          if (err?.type !== "not_found") {
            serviceUnavailable = true;
          }
        }
      }

      if (!hasSummary && nextData?.transcript?.fullText) {
        try {
          const summaryResponse = await summarizeTranscript(
            nextData.transcript.fullText,
          );
          const recovered = normalizeAIResultsPayload(summaryResponse);

          if (recovered.hasSummary) {
            nextData = {
              ...nextData,
              meetingSummary: recovered.meetingSummary,
            };
            hasSummary = true;
          } else {
            nextNotices.push("Summary generation failed.");
          }
        } catch (err) {
          nextNotices.push("Summary generation failed.");
          if (["network", "timeout", "service"].includes(err?.type)) {
            serviceUnavailable = true;
          }
        }
      }

      if (
        !hasTranscript &&
        !nextNotices.includes("Transcript not available.")
      ) {
        nextNotices.push("Transcript not available.");
      }

      if (!hasSummary && !nextNotices.includes("Summary generation failed.")) {
        nextNotices.push("Summary generation failed.");
      }

      if (
        serviceUnavailable &&
        !nextNotices.includes("Service temporarily unavailable.")
      ) {
        nextNotices.push("Service temporarily unavailable.");
      }

      if (cancelled) return;

      setResultData(nextData);
      setNotices(nextNotices);

      if (hasTranscript && hasSummary) {
        setViewState(VIEW_STATES.SUCCESS);
      } else if (hasTranscript || hasSummary) {
        setViewState(VIEW_STATES.PARTIAL);
      } else if (serviceUnavailable) {
        setViewState(VIEW_STATES.ERROR);
        setError("Service temporarily unavailable.");
      } else {
        setViewState(VIEW_STATES.EMPTY);
      }

      setLoading(false);
    };

    initializeResults();

    return () => {
      cancelled = true;
    };
  }, [location.state, meetingId]);

  const transcript = resultData?.transcript;
  const meetingSummary = resultData?.meetingSummary;
  const sessionSummary = resultData?.summary;

  // ── Copy / Download Hooks ──────────────────────────────────

  const getFullTextForExport = useCallback(() => {
    const parts = [];

    if (meetingSummary) {
      parts.push(`# ${meetingSummary.title || "Meeting Summary"}`);
      parts.push("");
      if (meetingSummary.overview) {
        parts.push(`## Overview`);
        parts.push(meetingSummary.overview);
        parts.push("");
      }
      if (meetingSummary.keyPoints?.length) {
        parts.push(`## Key Points`);
        meetingSummary.keyPoints.forEach((p) => parts.push(`• ${p}`));
        parts.push("");
      }
      if (meetingSummary.actionItems?.length) {
        parts.push(`## Action Items`);
        meetingSummary.actionItems.forEach((a) =>
          parts.push(`☐ ${a.task} — ${a.assignee} [${a.priority}]`),
        );
        parts.push("");
      }
      if (meetingSummary.decisions?.length) {
        parts.push(`## Decisions`);
        meetingSummary.decisions.forEach((d) => parts.push(`✓ ${d}`));
        parts.push("");
      }
    }

    if (transcript?.fullText) {
      parts.push("─".repeat(40));
      parts.push("");
      parts.push("## Full Transcript");
      parts.push("");
      parts.push(transcript.fullText);
    }

    return parts.join("\n");
  }, [meetingSummary, transcript]);

  const handleCopy = useCallback(async () => {
    try {
      const text = getFullTextForExport();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, [getFullTextForExport]);

  const handleDownload = useCallback(() => {
    const text = getFullTextForExport();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting-${meetingId || "results"}-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [getFullTextForExport, meetingId]);

  // ── Helpers ────────────────────────────────────────────────

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return "0s";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="results-page">
        <div className="results-loading">
          <div className="spinner" />
          <p>Loading meeting results...</p>
          <span>Assembling transcript and generating summary</span>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────

  if (error) {
    return (
      <div className="results-page">
        <div className="results-circle-1" />
        <div className="results-circle-2" />
        <header className="results-header">
          <div className="results-header-left">
            <button
              className="btn-back-results"
              onClick={() => navigate("/home")}
            >
              <ArrowLeftIcon /> Home
            </button>
          </div>
        </header>
        <div className="results-error">
          <div className="error-icon">!</div>
          <p>{error}</p>
          <span>Please go back and try ending the meeting again.</span>
          <button className="btn-retry" onClick={() => navigate("/home")}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (viewState === VIEW_STATES.EMPTY) {
    return (
      <div className="results-page">
        <div className="results-circle-1" />
        <div className="results-circle-2" />
        <header className="results-header">
          <div className="results-header-left">
            <button
              className="btn-back-results"
              onClick={() => navigate("/home")}
            >
              <ArrowLeftIcon /> Home
            </button>
          </div>
        </header>
        <div className="results-error">
          <div className="error-icon">!</div>
          <p>No meeting results available yet.</p>
          <span>
            Transcript or summary could not be generated for this meeting.
          </span>
          <button className="btn-retry" onClick={() => navigate("/home")}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // ── Tab count helpers ──────────────────────────────────────

  const segmentCount = transcript?.segments?.length || 0;
  const keyPointCount = meetingSummary?.keyPoints?.length || 0;
  const canExport = Boolean(getFullTextForExport().trim());

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="results-page">
      <div className="results-circle-1" />
      <div className="results-circle-2" />

      {/* Header */}
      <header className="results-header">
        <div className="results-header-left">
          <button
            className="btn-back-results"
            onClick={() => navigate("/home")}
          >
            <ArrowLeftIcon /> Home
          </button>
          <div className="results-title-block">
            <h1>{meetingSummary?.title || "Meeting Results"}</h1>
            <p>
              {sessionSummary?.users?.length || 0} participants
              {sessionSummary?.endedAt &&
                ` • Ended ${formatTime(sessionSummary.endedAt)}`}
            </p>
          </div>
        </div>
        <div className="results-header-actions">
          <button
            className={`btn-action ${copied ? "copied" : ""}`}
            onClick={handleCopy}
            disabled={!canExport}
            id="btn-copy-results"
          >
            {copied ? <CheckIcon /> : <ClipboardIcon />}
            {copied ? "Copied!" : "Copy All"}
          </button>
          <button
            className="btn-action"
            onClick={handleDownload}
            disabled={!canExport}
            id="btn-download-results"
          >
            <DownloadIcon /> Download
          </button>
        </div>
      </header>

      {(viewState === VIEW_STATES.PARTIAL || notices.length > 0) && (
        <div className="results-status-banner" role="status">
          {viewState === VIEW_STATES.PARTIAL && (
            <p>
              Some meeting insights are unavailable, but partial results are
              shown.
            </p>
          )}
          {notices.map((notice, index) => (
            <p key={`${notice}-${index}`}>{notice}</p>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="results-tabs">
        <button
          className={`results-tab ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
          id="tab-summary"
        >
          <SummaryIcon /> Summary
          {keyPointCount > 0 && (
            <span className="tab-badge">{keyPointCount}</span>
          )}
        </button>
        <button
          className={`results-tab ${activeTab === "transcript" ? "active" : ""}`}
          onClick={() => setActiveTab("transcript")}
          id="tab-transcript"
        >
          <TranscriptIcon /> Transcript
          {segmentCount > 0 && (
            <span className="tab-badge">{segmentCount}</span>
          )}
        </button>
        <button
          className={`results-tab ${activeTab === "stats" ? "active" : ""}`}
          onClick={() => setActiveTab("stats")}
          id="tab-stats"
        >
          <StatsIcon /> Stats
        </button>
      </div>

      {/* Content */}
      <div className="results-content">
        {activeTab === "summary" && <SummaryTab summary={meetingSummary} />}
        {activeTab === "transcript" && (
          <TranscriptTab transcript={transcript} formatTime={formatTime} />
        )}
        {activeTab === "stats" && (
          <StatsTab
            transcript={transcript}
            session={sessionSummary}
            summary={meetingSummary}
            formatDuration={formatDuration}
          />
        )}
      </div>
    </div>
  );
};

// ─── Sub-Components ─────────────────────────────────────────────

const SummaryTab = ({ summary }) => {
  if (!hasSummaryData(summary)) {
    return (
      <div className="summary-container">
        <div className="summary-card">
          <p className="empty-list">Summary generation failed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="summary-container">
      {/* Overview */}
      {summary.overview && (
        <div className="summary-card">
          <div className="summary-card-header">
            <div className="summary-card-icon accent">
              <SummaryIcon />
            </div>
            <h3>Overview</h3>
          </div>
          <p className="summary-overview">{summary.overview}</p>
        </div>
      )}

      {/* Key Points */}
      <div className="summary-card">
        <div className="summary-card-header">
          <div className="summary-card-icon accent">
            <KeyIcon />
          </div>
          <h3>Key Points</h3>
        </div>
        {summary.keyPoints?.length > 0 ? (
          <ul className="key-points-list">
            {summary.keyPoints.map((point, i) => (
              <li key={i} className="key-point-item">
                <div className="key-point-bullet" />
                <span>{point || "No key point text available"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-list">No key points identified</p>
        )}
      </div>

      {/* Action Items */}
      <div className="summary-card">
        <div className="summary-card-header">
          <div className="summary-card-icon success">
            <ActionIcon />
          </div>
          <h3>Action Items</h3>
        </div>
        {summary.actionItems?.length > 0 ? (
          <div className="action-items-list">
            {summary.actionItems.map((item, i) => (
              <div key={i} className="action-item">
                <div className="action-checkbox" />
                <div className="action-details">
                  <p className="action-task">
                    {item?.task || "Untitled action item"}
                  </p>
                  <div className="action-meta">
                    <span className="action-assignee">
                      {item?.assignee || "Unassigned"}
                    </span>
                    <span
                      className={`action-priority ${item?.priority || "medium"}`}
                    >
                      {item?.priority || "medium"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-list">No action items identified</p>
        )}
      </div>

      {/* Decisions */}
      <div className="summary-card">
        <div className="summary-card-header">
          <div className="summary-card-icon danger">
            <DecisionIcon />
          </div>
          <h3>Decisions Made</h3>
        </div>
        {summary.decisions?.length > 0 ? (
          <ul className="decisions-list">
            {summary.decisions.map((decision, i) => (
              <li key={i} className="decision-item">
                <span className="decision-icon">✓</span>
                <span>{decision || "No decision text available"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-list">No decisions recorded</p>
        )}
      </div>

      {/* Topics */}
      {summary.topics?.length > 0 && (
        <div className="summary-card">
          <div className="summary-card-header">
            <div className="summary-card-icon info">
              <TagIcon />
            </div>
            <h3>Topics Discussed</h3>
          </div>
          <div className="topics-list">
            {summary.topics.map((topic, i) => (
              <span key={i} className="topic-tag">
                {topic || "Untitled topic"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TranscriptTab = ({ transcript, formatTime }) => {
  if (!hasTranscriptData(transcript)) {
    return (
      <div className="transcript-container">
        <div className="summary-card">
          <p className="empty-list">Transcript not available.</p>
        </div>
      </div>
    );
  }

  const segments = Array.isArray(transcript?.segments)
    ? transcript.segments
    : [];

  return (
    <div className="transcript-container">
      {segments.map((seg, i) => (
        <div key={i} className="transcript-segment">
          <div className="transcript-meta">
            <span className="transcript-speaker">
              {seg?.speaker || "Speaker"}
            </span>
            <span className="transcript-time">
              {formatTime(seg?.startTime)}
              {seg?.endTime &&
                seg.endTime !== seg.startTime &&
                ` – ${formatTime(seg.endTime)}`}
            </span>
          </div>
          <p className="transcript-text">
            {seg?.text || "No transcript text available"}
          </p>
        </div>
      ))}
    </div>
  );
};

const StatsTab = ({ transcript, session, summary, formatDuration }) => {
  const speakerStats = Array.isArray(transcript?.speakerStats)
    ? transcript.speakerStats
    : [];
  const totalWords = speakerStats.reduce(
    (sum, stat) =>
      sum + (Number.isFinite(stat?.wordCount) ? stat.wordCount : 0),
    0,
  );
  const totalSegments = Array.isArray(transcript?.segments)
    ? transcript.segments.length
    : 0;
  const speakerCount = speakerStats.length;
  const meetingDuration =
    (Number.isFinite(transcript?.duration?.totalMs)
      ? transcript.duration.totalMs
      : 0) || (Number.isFinite(session?.durationMs) ? session.durationMs : 0);
  const maxWords = Math.max(
    ...(speakerStats.map((s) =>
      Number.isFinite(s?.wordCount) ? s.wordCount : 0,
    ) || [1]),
  );

  return (
    <div className="stats-container">
      {/* Quick stats grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Duration</span>
          <span className="stat-value">{formatDuration(meetingDuration)}</span>
          <span className="stat-sub">total meeting time</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Words Spoken</span>
          <span className="stat-value">{totalWords.toLocaleString()}</span>
          <span className="stat-sub">across all speakers</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Speakers</span>
          <span className="stat-value">{speakerCount}</span>
          <span className="stat-sub">participants spoke</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Segments</span>
          <span className="stat-value">{totalSegments}</span>
          <span className="stat-sub">transcript blocks</span>
        </div>
        {summary?.actionItems?.length > 0 && (
          <div className="stat-card">
            <span className="stat-label">Action Items</span>
            <span className="stat-value">{summary.actionItems.length}</span>
            <span className="stat-sub">tasks identified</span>
          </div>
        )}
        {summary?.decisions?.length > 0 && (
          <div className="stat-card">
            <span className="stat-label">Decisions</span>
            <span className="stat-value">{summary.decisions.length}</span>
            <span className="stat-sub">decisions made</span>
          </div>
        )}
      </div>

      {/* Speaker breakdown */}
      {speakerStats.length > 0 && (
        <div className="speaker-stats-card">
          <h3>Speaker Breakdown</h3>
          <table className="speaker-stats-table">
            <thead>
              <tr>
                <th>Speaker</th>
                <th>Words</th>
                <th>Segments</th>
                <th style={{ width: "30%" }}>Contribution</th>
              </tr>
            </thead>
            <tbody>
              {speakerStats.map((stat, i) => (
                <tr key={i}>
                  <td>{stat?.name || "Speaker"}</td>
                  <td>
                    {(Number.isFinite(stat?.wordCount)
                      ? stat.wordCount
                      : 0
                    ).toLocaleString()}
                  </td>
                  <td>
                    {Number.isFinite(stat?.segmentCount)
                      ? stat.segmentCount
                      : 0}
                  </td>
                  <td>
                    <div className="word-bar-cell">
                      <div
                        className="word-bar"
                        style={{
                          width: `${
                            maxWords > 0
                              ? ((Number.isFinite(stat?.wordCount)
                                  ? stat.wordCount
                                  : 0) /
                                  maxWords) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {totalWords > 0
                          ? Math.round(
                              ((Number.isFinite(stat?.wordCount)
                                ? stat.wordCount
                                : 0) /
                                totalWords) *
                                100,
                            )
                          : 0}
                        %
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MeetingResultsPage;
