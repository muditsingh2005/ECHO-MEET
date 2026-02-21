/**
 * In-memory room manager for tracking active meetings and participants
 */

// Store: meetingId -> Set of userIds
const rooms = new Map();

/**
 * Add a user to a meeting room
 * @param {string} meetingId - The meeting identifier
 * @param {string} userId - The user identifier
 */
export const addUser = (meetingId, userId) => {
  if (!rooms.has(meetingId)) {
    rooms.set(meetingId, new Set());
  }
  rooms.get(meetingId).add(userId);
};

/**
 * Remove a user from a meeting room
 * @param {string} meetingId - The meeting identifier
 * @param {string} userId - The user identifier
 * @returns {boolean} - True if user was removed, false if not found
 */
export const removeUser = (meetingId, userId) => {
  const room = rooms.get(meetingId);

  if (!room) {
    return false;
  }

  const removed = room.delete(userId);

  // Clean up empty rooms
  if (room.size === 0) {
    rooms.delete(meetingId);
  }

  return removed;
};

/**
 * Get all participants in a meeting room
 * @param {string} meetingId - The meeting identifier
 * @returns {string[]} - Array of user IDs
 */
export const getParticipants = (meetingId) => {
  const room = rooms.get(meetingId);
  return room ? Array.from(room) : [];
};

/**
 * Check if a user is in a specific room
 * @param {string} meetingId - The meeting identifier
 * @param {string} userId - The user identifier
 * @returns {boolean}
 */
export const isUserInRoom = (meetingId, userId) => {
  const room = rooms.get(meetingId);
  return room ? room.has(userId) : false;
};

/**
 * Get the count of participants in a room
 * @param {string} meetingId - The meeting identifier
 * @returns {number}
 */
export const getParticipantCount = (meetingId) => {
  const room = rooms.get(meetingId);
  return room ? room.size : 0;
};

/**
 * Get all active room IDs
 * @returns {string[]}
 */
export const getActiveRooms = () => {
  return Array.from(rooms.keys());
};

/**
 * Clear all rooms (useful for testing)
 */
export const clearAllRooms = () => {
  rooms.clear();
};
