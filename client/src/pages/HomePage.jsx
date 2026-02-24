import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context";
import api from "../services/api";
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

const LoaderIcon = () => (
  <svg
    className="spinner-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" opacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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

const HomePage = () => {
  const [meetingId, setMeetingId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    title: "",
    description: "",
    scheduledFor: "",
  });
  const [formError, setFormError] = useState("");
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Get minimum datetime (now)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const openCreateModal = () => {
    setMeetingForm({
      title: "",
      description: "",
      scheduledFor: getMinDateTime(),
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormError("");
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setMeetingForm((prev) => ({ ...prev, [name]: value }));
    if (formError) setFormError("");
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();

    // Validation
    if (!meetingForm.title.trim()) {
      setFormError("Please enter a meeting title");
      return;
    }
    if (!meetingForm.description.trim()) {
      setFormError("Please enter a description");
      return;
    }
    if (!meetingForm.scheduledFor) {
      setFormError("Please select a date and time");
      return;
    }

    setIsCreating(true);
    setFormError("");

    try {
      const response = await api.post("/v2/meeting/create", {
        title: meetingForm.title.trim(),
        scheduledFor: new Date(meetingForm.scheduledFor).toISOString(),
        description: meetingForm.description.trim(),
      });

      if (response.data.success && response.data.meetingId) {
        setShowModal(false);
        navigate(`/meeting/${response.data.meetingId}`);
      } else {
        setFormError("Failed to create meeting. Please try again.");
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to create meeting. Please try again.";
      setFormError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinMeeting = () => {
    if (!meetingId.trim()) {
      setError("Please enter a meeting ID");
      return;
    }
    setError("");
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

            {/* Error Message */}
            {error && <div className="error-message">{error}</div>}

            {/* Create Meeting */}
            <button
              className="btn btn-primary btn-large"
              onClick={openCreateModal}
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
                  onChange={(e) => {
                    setMeetingId(e.target.value);
                    if (error) setError("");
                  }}
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

      {/* Create Meeting Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Meeting</h3>
              <button className="modal-close" onClick={closeModal}>
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} className="modal-form">
              {formError && <div className="error-message">{formError}</div>}

              <div className="form-group">
                <label htmlFor="title">Meeting Title</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={meetingForm.title}
                  onChange={handleFormChange}
                  placeholder="e.g., Team Standup"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={meetingForm.description}
                  onChange={handleFormChange}
                  placeholder="What's this meeting about?"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="scheduledFor">
                  <CalendarIcon />
                  Schedule Date & Time
                </label>
                <input
                  type="datetime-local"
                  id="scheduledFor"
                  name="scheduledFor"
                  value={meetingForm.scheduledFor}
                  onChange={handleFormChange}
                  min={getMinDateTime()}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <LoaderIcon />
                      Creating...
                    </>
                  ) : (
                    <>
                      <VideoIcon />
                      Create Meeting
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
