import Document from "../models/Document.js";
import { otRooms, getRoomActiveUsers } from "./state.js";

export function getDocSaveUpdates(room) {
    const opsStr = JSON.stringify(room.content?.ops || []);
    const fileSize = Buffer.byteLength(opsStr, "utf8");
    return {
        content: { ops: room.content?.ops || [] },
        version: room.version,
        fileSize: fileSize,
        lastEdited: room.lastEdited || new Date()
    };
}

export async function checkAndCleanupRoom(roomId) {
    const activeUsers = getRoomActiveUsers(roomId);
    if (activeUsers.length === 0) {
        const room = otRooms.get(roomId);
        if (room) {
            if (room.saveTimer) clearTimeout(room.saveTimer);
            try {
                await Document.findByIdAndUpdate(roomId, getDocSaveUpdates(room));
                console.log(`Room ${roomId} is empty. Saved final snapshot to DB and cleaned up.`);
            } catch (err) {
                console.error(`Error saving empty room ${roomId}:`, err);
            }
            otRooms.delete(roomId);
        }
    }
}
