import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context";
import "./HomePage.css";

// Icons as components
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

const UsersIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const LogOutIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16,17 21,12 16,7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const GridIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const LinkIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const HomePage = () => {
  const [meetingId, setMeetingId] = useState("");
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleCreateMeeting = () => {
    // TODO: API integration
    console.log("Create meeting clicked");
    navigate("/create-meeting");
  };

  const handleJoinMeeting = () => {
    if (!meetingId.trim()) {
      alert("Please enter a meeting ID");
      return;
    }
    // TODO: API integration
    console.log("Joining meeting:", meetingId);
    navigate(`/meeting/${meetingId.trim()}`);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleJoinMeeting();
    }
  };

  return (
    <div className="home-page">
      {/* Decorative Elements */}
      <div className="decor-circle home-circle-1"></div>
      <div className="decor-circle home-circle-2"></div>

      {/* Header */}
      <header className="home-header">
        <div className="logo">
          <span className="logo-icon">
            <VideoIcon />
          </span>
          ECHO-MEET
        </div>
        <div className="header-right">
          <div className="user-info">
            <div className="user-avatar">{user?.name?.charAt(0) || "U"}</div>
            <span className="user-name">{user?.name}</span>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => navigate("/dashboard")}
            title="Dashboard"
          >
            <GridIcon />
            <span className="btn-text">Dashboard</span>
          </button>
          <button className="btn btn-ghost" onClick={logout} title="Logout">
            <LogOutIcon />
            <span className="btn-text">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="home-main">
        <div className="home-content">
          {/* Left - Hero Section */}
          <div className="hero-section">
            <div className="hero-icon">
              <UsersIcon />
            </div>
            <h1>Connect with Anyone, Anywhere</h1>
            <p>
              High-quality video meetings for teams and individuals. Simple,
              secure, and reliable.
            </p>

            <div className="feature-badges">
              <span className="badge">🎥 HD Quality</span>
              <span className="badge">🔐 End-to-End Encrypted</span>
              <span className="badge">⚡ Low Latency</span>
            </div>
          </div>

          {/* Right - Action Card */}
          <div className="home-card">
            <div className="card-header">
              <h2>Start or Join</h2>
              <p>Get connected in seconds</p>
            </div>

            {/* Create Meeting */}
            <button
              className="btn btn-primary btn-large"
              onClick={handleCreateMeeting}
            >
              <VideoIcon />
              Create New Meeting
            </button>

            <div className="divider">
              <span>or join existing</span>
            </div>

            {/* Join Meeting */}
            <div className="join-section">
              <div className="input-wrapper">
                <span className="input-icon">
                  <LinkIcon />
                </span>
                <input
                  type="text"
                  className="meeting-input"
                  placeholder="Enter Meeting ID"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
              </div>
              <button
                className="btn btn-secondary btn-large"
                onClick={handleJoinMeeting}
              >
                Join Meeting
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
