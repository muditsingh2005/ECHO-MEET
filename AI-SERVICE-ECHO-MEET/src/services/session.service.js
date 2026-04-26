/**
 * In-memory session store for active AI sessions.
 *
 * Structure:
 *   Map<roomId, {
 *     roomId:        string,
 *     hostId:        string,            — user who started the session
 *     createdAt:     Date,
 *     lastActive:    Date,
 *     users:         Map<userId, { userId, name, joinedAt }>,
 *     audioChunks:   { buffer, userId, timestamp }[],
 *     transcript:    { userId, name, text, timestamp }[],
 *     metadata:      object,
 *   }>
 */
const sessions = new Map();

// ─── Session Lifecycle ───────────────────────────────────────────

/**
 * Create a new AI session for a room.
 * If one already exists, returns the existing session (idempotent).
 */
export const createSession = (roomId, userId, userName) => {
  if (sessions.has(roomId)) {
    const existing = sessions.get(roomId);
    // Ensure the caller is tracked as a user
    addUser(roomId, userId, userName);
    existing.lastActive = new Date();
    return { session: _safeSnapshot(existing), created: false };
  }

  const session = {
    roomId,
    hostId: userId,
    createdAt: new Date(),
    lastActive: new Date(),
    users: new Map(),
    audioChunks: [],
    transcript: [],
    metadata: {},
  };

  // Add the creator as the first user
  session.users.set(userId, {
    userId,
    name: userName,
    joinedAt: new Date(),
  });

  sessions.set(roomId, session);
  console.log(`[SESSION] Created — room=${roomId} host=${userId}`);
  return { session: _safeSnapshot(session), created: true };
};

/**
 * End and delete a session. Returns the final snapshot for
 * post-processing (transcript, stats) or null if not found.
 */
export const endSession = (roomId) => {
  const session = sessions.get(roomId);
  if (!session) return null;

  const snapshot = {
    roomId: session.roomId,
    hostId: session.hostId,
    createdAt: session.createdAt,
    endedAt: new Date(),
    users: Array.from(session.users.values()),
    transcript: session.transcript,
    totalAudioChunks: session.audioChunks.length,
    totalAudioBytes: session.audioChunks.reduce((s, c) => s + c.buffer.length, 0),
    metadata: session.metadata,
  };

  sessions.delete(roomId);
  console.log(
    `[SESSION] Ended — room=${roomId} users=${snapshot.users.length} ` +
      `chunks=${snapshot.totalAudioChunks} transcript_lines=${snapshot.transcript.length}`,
  );

  return snapshot;
};

// ─── User Management ─────────────────────────────────────────────

/**
 * Add a user to an existing session.
 */
export const addUser = (roomId, userId, userName) => {
  const session = sessions.get(roomId);
  if (!session) return { success: false, error: "Session not found" };

  if (!session.users.has(userId)) {
    session.users.set(userId, {
      userId,
      name: userName,
      joinedAt: new Date(),
    });
    console.log(`[SESSION] User joined — room=${roomId} user=${userId}`);
  }

  session.lastActive = new Date();
  return { success: true, userCount: session.users.size };
};

/**
 * Remove a user from a session.
 */
export const removeUser = (roomId, userId) => {
  const session = sessions.get(roomId);
  if (!session) return { success: false, error: "Session not found" };

  const removed = session.users.delete(userId);
  session.lastActive = new Date();

  if (removed) {
    console.log(`[SESSION] User left — room=${roomId} user=${userId}`);
  }

  return { success: true, removed, userCount: session.users.size };
};

// ─── Audio Chunks ────────────────────────────────────────────────

/**
 * Append an audio buffer to an existing session.
 */
export const appendAudioChunk = (roomId, buffer, userId) => {
  const session = sessions.get(roomId);
  if (!session) return { success: false, error: "Session not found" };

  session.audioChunks.push({
    buffer,
    userId,
    timestamp: new Date(),
  });
  session.lastActive = new Date();

  return {
    success: true,
    chunkIndex: session.audioChunks.length - 1,
    totalChunks: session.audioChunks.length,
  };
};

// ─── Transcript Buffer ──────────────────────────────────────────

/**
 * Append a transcript entry to the session.
 */
export const appendTranscript = (roomId, userId, name, text) => {
  const session = sessions.get(roomId);
  if (!session) return { success: false, error: "Session not found" };

  const entry = {
    userId,
    name,
    text,
    timestamp: new Date(),
  };

  session.transcript.push(entry);
  session.lastActive = new Date();

  return {
    success: true,
    entryIndex: session.transcript.length - 1,
    totalEntries: session.transcript.length,
  };
};

/**
 * Get the full transcript for a session.
 */
export const getTranscript = (roomId) => {
  const session = sessions.get(roomId);
  if (!session) return null;
  return session.transcript;
};

// ─── Queries ─────────────────────────────────────────────────────

/**
 * Get session info (without raw audio buffers).
 */
export const getSession = (roomId) => {
  const session = sessions.get(roomId);
  if (!session) return null;
  return _safeSnapshot(session);
};

/**
 * Check if a session exists for a room.
 */
export const hasSession = (roomId) => sessions.has(roomId);

/**
 * Get all active session room IDs.
 */
export const getActiveSessions = () => Array.from(sessions.keys());

// ─── Internal Helpers ────────────────────────────────────────────

/**
 * Build a safe snapshot (no raw buffers exposed).
 */
function _safeSnapshot(session) {
  return {
    roomId: session.roomId,
    hostId: session.hostId,
    createdAt: session.createdAt,
    lastActive: session.lastActive,
    users: Array.from(session.users.values()),
    totalAudioChunks: session.audioChunks.length,
    totalAudioBytes: session.audioChunks.reduce((s, c) => s + c.buffer.length, 0),
    transcriptLength: session.transcript.length,
  };
}
