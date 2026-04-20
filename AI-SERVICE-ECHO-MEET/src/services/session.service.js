/**
 * In-memory session store for active AI sessions.
 *
 * Structure:
 *   Map<roomId, {
 *     roomId:      string,
 *     userId:      string,
 *     userName:    string,
 *     createdAt:   Date,
 *     lastActive:  Date,
 *     audioChunks: Buffer[],
 *     metadata:    object,
 *   }>
 */
const sessions = new Map();

/**
 * Create a new AI session for a room.
 * Returns the created session object.
 */
export const createSession = (roomId, userId, userName) => {
  if (sessions.has(roomId)) {
    // Update existing session instead of duplicating
    const existing = sessions.get(roomId);
    existing.lastActive = new Date();
    return existing;
  }

  const session = {
    roomId,
    userId,
    userName,
    createdAt: new Date(),
    lastActive: new Date(),
    audioChunks: [],
    metadata: {},
  };

  sessions.set(roomId, session);
  console.log(`[SESSION] Created — room=${roomId} user=${userId}`);
  return session;
};

/**
 * Append an audio buffer to an existing session.
 * Returns { success, chunkIndex } or throws if session not found.
 */
export const appendAudioChunk = (roomId, buffer) => {
  const session = sessions.get(roomId);

  if (!session) {
    return { success: false, error: "Session not found" };
  }

  session.audioChunks.push(buffer);
  session.lastActive = new Date();

  return {
    success: true,
    chunkIndex: session.audioChunks.length - 1,
    totalChunks: session.audioChunks.length,
  };
};

/**
 * End and clean up a session. Returns the final session snapshot
 * (without the raw buffers) for post-processing / logging.
 */
export const endSession = (roomId) => {
  const session = sessions.get(roomId);

  if (!session) {
    return null;
  }

  const snapshot = {
    roomId: session.roomId,
    userId: session.userId,
    userName: session.userName,
    createdAt: session.createdAt,
    endedAt: new Date(),
    totalChunks: session.audioChunks.length,
    totalBytes: session.audioChunks.reduce((sum, buf) => sum + buf.length, 0),
    metadata: session.metadata,
  };

  sessions.delete(roomId);
  console.log(
    `[SESSION] Ended — room=${roomId} chunks=${snapshot.totalChunks} bytes=${snapshot.totalBytes}`,
  );

  return snapshot;
};

/**
 * Get session info (without raw buffers).
 */
export const getSession = (roomId) => {
  const session = sessions.get(roomId);
  if (!session) return null;

  return {
    roomId: session.roomId,
    userId: session.userId,
    userName: session.userName,
    createdAt: session.createdAt,
    lastActive: session.lastActive,
    totalChunks: session.audioChunks.length,
    totalBytes: session.audioChunks.reduce((sum, buf) => sum + buf.length, 0),
  };
};

/**
 * Get all active session room IDs.
 */
export const getActiveSessions = () => {
  return Array.from(sessions.keys());
};
