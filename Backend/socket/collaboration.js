import Delta from "quill-delta";
import Document from "../models/Document.js";
import { DocumentQueue } from "../util/DocumentQueue.js";
import { getValidObjectId } from "../util/crypto.js";
import { addToSharedTo } from "../controllers/DocumentController.js";
import { otRooms, MAX_HISTORY, addUserToRoom, removeUserFromRoom } from "./state.js";
import { broadcastUserLists } from "./roomManager.js";
import { getDocSaveUpdates, checkAndCleanupRoom } from "./cleanup.js";

// ── Join Room (direct, for the owner or already-shared users) ─────────────
export async function handleJoinRoom(io, socket, rawId, username) {
    const id = getValidObjectId(rawId);
    if (!id) return;

    if (socket.currentRoom && socket.currentRoom !== id) {
        socket.to(socket.currentRoom).emit("user-left", socket.username || socket.id);
        removeUserFromRoom(socket.currentRoom, socket.id);
        socket.leave(socket.currentRoom);
    }
    socket.currentRoom = id;
    socket.username = username;
    socket.join(id);

    addUserToRoom(id, socket.id, username);
    io.to(id).emit("user-joined", username || socket.id);

    try {
        const document = await Document.findById(id)
            .populate("owner", "username _id");
        if (document) {
            let room = otRooms.get(id);
            if (!room) {
                let docContent = [];
                if (document.content) {
                    docContent = Array.isArray(document.content.ops) ? document.content.ops : (Array.isArray(document.content) ? document.content : []);
                }
                room = {
                    content: new Delta(docContent),
                    version: document.version || 0,
                    operations: [],
                    queue: new DocumentQueue(),
                    saveTimer: null,
                    lastEdited: document.lastEdited || new Date()
                };
                otRooms.set(id, room);
            }

            socket.emit("load-document", {
                content: room.content.ops,
                version: room.version,
                title: document.title,
                description: document.description || "",
                ownerUsername: document.owner?.username || "Unknown",
                ownerId: document.owner?._id?.toString() || "",
            });

            // Auto-add to sharedTo if not owner and not already there
            const isOwner = document.owner?._id?.toString() === socket.userId?.toString();
            if (!isOwner && socket.userId) {
                await addToSharedTo(id, socket.userId);
            }
        }
    } catch (err) {
        console.error("Error loading document on join:", err);
    }

    await broadcastUserLists(io, id);
}

// ── Save Document ─────────────────────────────────────────────────────────
export async function handleSaveDocument(socket, rawId) {
    const id = getValidObjectId(rawId);
    if (!id) return;

    const room = otRooms.get(id);
    if (room) {
        room.lastEdited = new Date();
        try {
            await Document.findByIdAndUpdate(id, getDocSaveUpdates(room));
        } catch (err) {
            console.error("Error saving document:", err);
        }
    }
}

// ── Rename Document ───────────────────────────────────────────────────────
export async function handleRenameDocument(io, socket, rawId, title) {
    const id = getValidObjectId(rawId);
    if (!id) return;

    try {
        await Document.findByIdAndUpdate(id, { title });

        socket.to(id).emit("document-renamed", socket.username || socket.id, title);

        if (socket.currentRoom && socket.currentRoom !== id) {
            socket.to(socket.currentRoom).emit("document-renamed", socket.username || socket.id, title);
        }

        socket.emit("document-renamed", socket.username || socket.id, title);

    } catch (err) {
        console.error("Error renaming document:", err);
    }
}

// ── Send Delta (Operational Transformation) ──────────────────────────────
export function handleSendDelta(io, socket, payload) {
    const { docId: rawDocId, delta, clientVersion } = payload || {};
    const docId = getValidObjectId(rawDocId);
    if (!docId || !delta || typeof clientVersion !== "number") return;

    const room = otRooms.get(docId);
    if (!room) return;

    room.queue.enqueue(async () => {
        const incomingDelta = new Delta(delta.ops || delta);

        // Force resync if client is too far behind and history is lost
        const oldestStoredVersion = room.operations.length > 0 ? room.operations[0].version : room.version;
        if (clientVersion < oldestStoredVersion && clientVersion !== room.version) {
            socket.emit("force-resync", {
                content: room.content.ops,
                version: room.version
            });
            return;
        }

        let transformedDelta = incomingDelta;

        // Transform incoming delta if client is behind
        if (clientVersion < room.version) {
            const missedOps = room.operations.filter(op => op.version > clientVersion);
            for (const op of missedOps) {
                transformedDelta = op.delta.transform(transformedDelta, true);
            }
        }

        // Apply transformed delta to authoritative content
        room.content = room.content.compose(transformedDelta);
        room.version += 1;
        room.lastEdited = new Date();

        // Store transformed delta in history log
        room.operations.push({
            version: room.version,
            delta: transformedDelta,
            socketId: socket.id
        });

        // Keep history log bounded to MAX_HISTORY (500)
        if (room.operations.length > MAX_HISTORY) {
            room.operations.shift();
        }

        // Broadcast to other room members
        socket.to(docId).emit("receive-delta", {
            delta: transformedDelta.ops,
            version: room.version,
            senderId: socket.id
        });

        // Acknowledge the sender
        socket.emit("ack-delta", { version: room.version });

        // Debounced save to database (5 seconds)
        if (room.saveTimer) clearTimeout(room.saveTimer);
        room.saveTimer = setTimeout(async () => {
            try {
                await Document.findByIdAndUpdate(docId, getDocSaveUpdates(room));
                console.log(`Autosaved document ${docId} to MongoDB at version ${room.version}`);
            } catch (err) {
                console.error("Autosave error:", err);
            }
        }, 5000);
    });
}

// ── Chat Message ──────────────────────────────────────────────────────────
export function handleChatMessage(socket, rawId, username, message) {
    const id = getValidObjectId(rawId);
    if (!id) return;
    socket.to(id).emit("receive-chat-message", username, message);
}

// ── Leave Room ────────────────────────────────────────────────────────────
export async function handleLeaveRoom(io, socket, rawId, username) {
    const id = getValidObjectId(rawId);
    if (!id) return;

    console.log(`socket ${socket.id} left room ${id}`);
    socket.to(id).emit("user-left", username || socket.id);
    removeUserFromRoom(id, socket.id);
    socket.leave(id);
    socket.currentRoom = null;
    await broadcastUserLists(io, id);
    await checkAndCleanupRoom(id);
}

// ── Description update via socket (real-time sync to room) ───────────────
export async function handleUpdateDescription(io, socket, rawDocId, description) {
    const docId = getValidObjectId(rawDocId);
    if (!docId) return;

    try {
        await Document.findByIdAndUpdate(docId, { description });
        // Broadcast new description to everyone in the room
        io.to(docId).emit("description-updated", description);
    } catch (err) {
        console.error("Error updating description:", err);
    }
}
