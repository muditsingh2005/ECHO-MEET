const rooms = new Map();

export const addUser = (meetingId, userId) => {
  if (!rooms.has(meetingId)) {
    rooms.set(meetingId, new Set());
  }
  rooms.get(meetingId).add(userId);
};

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

export const getParticipants = (meetingId) => {
  const room = rooms.get(meetingId);
  return room ? Array.from(room) : [];
};

export const isUserInRoom = (meetingId, userId) => {
  const room = rooms.get(meetingId);
  return room ? room.has(userId) : false;
};

export const getParticipantCount = (meetingId) => {
  const room = rooms.get(meetingId);
  return room ? room.size : 0;
};

export const getActiveRooms = () => {
  return Array.from(rooms.keys());
};

export const clearAllRooms = () => {
  rooms.clear();
};
