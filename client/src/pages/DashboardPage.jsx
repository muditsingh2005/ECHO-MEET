import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context";
import api from "../services/api";
import "./DashboardPage.css";

// Icons
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

const CalendarIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const VideoIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="5" width="14" height="14" rx="2" />
    <path d="M20 7l-4 4 4 4V7z" />
  </svg>
);

const UserIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MailIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const RefreshIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMeetingHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/v2/meeting/user/history");
      if (response.data.success) {
        setMeetings(response.data.meetings || []);
      } else {
        setError("Failed to load meetings");
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to load meeting history";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetingHistory();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleMeetingClick = (meetingId) => {
    navigate(`/meeting/${meetingId}`);
  };

  return (
    <div className="dashboard-page">
      {/* Decorative Elements */}
      <div className="decor-circle dashboard-circle-1"></div>
      <div className="decor-circle dashboard-circle-2"></div>

      {/* Header */}
      <header className="dashboard-header">
        <button className="btn-back" onClick={() => navigate("/home")}>
          <ArrowLeftIcon />
          Back
        </button>
        <h1 className="dashboard-title">Dashboard</h1>
        <button
          className="btn-refresh"
          onClick={fetchMeetingHistory}
          disabled={loading}
          title="Refresh"
        >
          <RefreshIcon />
        </button>
      </header>

      <main className="dashboard-content">
        {/* User Profile Card */}
        <section className="profile-card">
          <div className="profile-avatar">{user?.name?.charAt(0) || "U"}</div>
          <div className="profile-details">
            <div className="profile-item">
              <UserIcon />
              <span className="profile-label">Name</span>
              <span className="profile-value">{user?.name || "Unknown"}</span>
            </div>
            <div className="profile-item">
              <MailIcon />
              <span className="profile-label">Email</span>
              <span className="profile-value">{user?.email || "No email"}</span>
            </div>
          </div>
        </section>

        {/* Meetings Section */}
        <section className="meetings-section">
          <h2 className="section-title">
            <VideoIcon />
            Meeting History
          </h2>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading meetings...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>{error}</p>
              <button className="btn-retry" onClick={fetchMeetingHistory}>
                Try Again
              </button>
            </div>
          ) : meetings.length === 0 ? (
            <div className="empty-state">
              <VideoIcon />
              <p>No meetings yet</p>
              <span>Your meeting history will appear here</span>
            </div>
          ) : (
            <div className="meetings-list">
              {meetings.map((meeting) => (
                <div
                  key={meeting._id || meeting.meetingId}
                  className="meeting-card"
                  onClick={() => handleMeetingClick(meeting.meetingId)}
                >
                  <div className="meeting-card-header">
                    <h3 className="meeting-title">{meeting.title}</h3>
                    <span
                      className={`meeting-status ${meeting.isActive ? "active" : "ended"}`}
                    >
                      {meeting.isActive ? "Active" : "Ended"}
                    </span>
                  </div>
                  <p className="meeting-description">{meeting.description}</p>
                  <div className="meeting-meta">
                    <span className="meeting-date">
                      <CalendarIcon />
                      {formatDate(meeting.scheduledFor)}
                    </span>
                    <span className="meeting-id-badge">
                      {meeting.meetingId?.slice(0, 8)}...
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;
