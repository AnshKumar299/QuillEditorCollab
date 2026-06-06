import { handleRequestJoin, handleRespondJoin } from "./joinRequests.js";
import {
    handleJoinRoom,
    handleSaveDocument,
    handleRenameDocument,
    handleSendDelta,
    handleChatMessage,
    handleLeaveRoom,
    handleUpdateDescription,
    handleCursorUpdate
} from "./collaboration.js";
import { removeUserFromRoom } from "./state.js";
import { broadcastUserLists } from "./roomManager.js";
import { checkAndCleanupRoom } from "./cleanup.js";
import { socketAuthMiddleware } from "../middlewares/SocketAuthMiddleware.js";

export function initSocket(io) {
    // ── JWT Auth Middleware ────────────────────────────────────────────────────
    // Runs before any "connection" event. Rejects sockets with missing/invalid
    // tokens so no handler below ever processes an unauthenticated request.
    io.use(socketAuthMiddleware);

    io.on("connection", (socket) => {
        console.log("a user connected");
        console.log("ID : " + socket.id);

        socket.on("disconnect", async () => {
            console.log(socket.id + " disconnected");
            // Skip if leave-room already ran cleanup for this socket
            if (socket.currentRoom && !socket.cleanupDone) {
                const roomId = socket.currentRoom;
                // Remove cursor from all peers immediately (tab close / network drop)
                socket.to(roomId).emit("cursor-remove", { socketId: socket.id });
                socket.to(roomId).emit("user-left", socket.username || socket.id);
                removeUserFromRoom(roomId, socket.id);
                await broadcastUserLists(io, roomId);
                await checkAndCleanupRoom(roomId);
            }
        });

        // ── Join Room (direct, for the owner or already-shared users) ─────────────
        socket.on("join-room", async (rawId, username) => {
            await handleJoinRoom(io, socket, rawId, username);
        });

        // ── Request to Join (for new users who aren't in sharedTo yet) ────────────
        socket.on("request-join", async (payload) => {
            await handleRequestJoin(io, socket, payload);
        });

        // ── Owner responds to join request ────────────────────────────────────────
        socket.on("respond-join", async (payload) => {
            await handleRespondJoin(io, socket, payload);
        });

        // ── Save Document ──────────────────────────────────────────────────────────
        socket.on("save-document", async (rawId) => {
            await handleSaveDocument(socket, rawId);
        });

        // ── Rename Document ────────────────────────────────────────────────────────
        socket.on("rename-document", async (rawId, title) => {
            await handleRenameDocument(io, socket, rawId, title);
        });

        // ── Send Delta ─────────────────────────────────────────────────────────────
        socket.on("send-delta", (payload) => {
            handleSendDelta(io, socket, payload);
        });

        // ── Chat Message ─────────────────────────────────────────────────────────
        socket.on("chat-message", (rawId, message) => {
            handleChatMessage(socket, rawId, message);
        });

        // ── Leave Room ─────────────────────────────────────────────────────────────
        socket.on("leave-room", async (rawId) => {
            await handleLeaveRoom(io, socket, rawId);
        });

        // ── Description update via socket (real-time sync to room) ───────────────
        socket.on("update-description", async (rawDocId, description) => {
            await handleUpdateDescription(io, socket, rawDocId, description);
        });

        // ── Cursor Update (live cursors) ──────────────────────────────────────────
        socket.on("cursor-update", (payload) => {
            handleCursorUpdate(socket, payload);
        });
    });
}
