// Map: roomId -> Map(socketId -> { username, userId })
export const activeRooms = new Map();

// Map: roomId -> { content, version, operations, queue, saveTimer, lastEdited }
export const otRooms = new Map();

// Map: socketId -> { ownerSocketId, docId } (pending join requests)
export const pendingRequests = new Map();

export const MAX_HISTORY = 500;

// Returns an array of display usernames for the room (used by broadcast + sidebar)
export function getRoomActiveUsers(roomId) {
    const room = activeRooms.get(roomId);
    if (!room) return [];
    return Array.from(room.values()).map((entry) => entry.username);
}

export function addUserToRoom(roomId, socketId, username, userId) {
    if (!activeRooms.has(roomId)) activeRooms.set(roomId, new Map());
    activeRooms.get(roomId).set(socketId, { username, userId });
}

export function removeUserFromRoom(roomId, socketId) {
    const room = activeRooms.get(roomId);
    if (room) {
        room.delete(socketId);
        if (room.size === 0) activeRooms.delete(roomId);
    }
}
