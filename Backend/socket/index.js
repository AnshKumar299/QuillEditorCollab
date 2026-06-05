import { handleRequestJoin, handleRespondJoin } from "./joinRequests.js";
import {
    handleJoinRoom,
    handleSaveDocument,
    handleRenameDocument,
    handleSendDelta,
    handleChatMessage,
    handleLeaveRoom,
    handleUpdateDescription
} from "./collaboration.js";
import { removeUserFromRoom } from "./state.js";
import { broadcastUserLists } from "./roomManager.js";
import { checkAndCleanupRoom } from "./cleanup.js";

export function initSocket(io) {
    io.on("connection", (socket) => {
        console.log("a user connected");
        console.log("ID : " + socket.id);

        socket.on("disconnect", async () => {
            console.log(socket.id + " disconnected");
            if (socket.currentRoom) {
                const roomId = socket.currentRoom;
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

        // ── Chat Message ───────────────────────────────────────────────────────────
        socket.on("chat-message", (rawId, username, message) => {
            handleChatMessage(socket, rawId, username, message);
        });

        // ── Leave Room ─────────────────────────────────────────────────────────────
        socket.on("leave-room", async (rawId, username) => {
            await handleLeaveRoom(io, socket, rawId, username);
        });

        // ── Description update via socket (real-time sync to room) ───────────────
        socket.on("update-description", async (rawDocId, description) => {
            await handleUpdateDescription(io, socket, rawDocId, description);
        });
    });
}
