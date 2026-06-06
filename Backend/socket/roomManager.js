import Document from "../models/Document.js";
import { activeRooms, getRoomActiveUsers } from "./state.js";

// Helper: find owner socket in a room
export async function findOwnerSocket(roomId) {
    try {
        const doc = await Document.findById(roomId).populate("owner", "_id");
        if (!doc) return null;
        const ownerUserId = doc.owner._id.toString();

        const room = activeRooms.get(roomId);
        if (!room) return null;

        for (const [sid, entry] of room.entries()) {
            if (entry.userId === ownerUserId) {
                return { socketId: sid, username: entry.username };
            }
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
