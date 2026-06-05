import Document from "../models/Document.js";
import { activeRooms, getRoomActiveUsers } from "./state.js";

// Helper: find owner socket in a room
export async function findOwnerSocket(roomId) {
    try {
        const doc = await Document.findById(roomId).populate("owner", "username");
        if (!doc) return null;
        const ownerUsername = doc.owner.username;

        const room = activeRooms.get(roomId);
        if (!room) return null;

        for (const [sid, uname] of room.entries()) {
            if (uname === ownerUsername) return { socketId: sid, username: ownerUsername };
        }
        return null; // owner not currently in room
    } catch {
        return null;
    }
}

// Helper: emit updated user lists to all in a room
export async function broadcastUserLists(io, roomId) {
    try {
        const doc = await Document.findById(roomId)
            .populate("owner", "username")
            .populate("sharedTo", "username");

        const activeUsers = getRoomActiveUsers(roomId);

        // All users = owner + everyone in sharedTo
        const allUsernames = new Set();
        if (doc) {
            allUsernames.add(doc.owner.username);
            doc.sharedTo.forEach(u => allUsernames.add(u.username));
        }

        io.to(roomId).emit("user-lists-update", {
            activeUsers,
            allUsers: Array.from(allUsernames),
        });
    } catch (err) {
        console.error("broadcastUserLists error:", err);
    }
}
