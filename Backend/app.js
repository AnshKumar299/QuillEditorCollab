import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoute from "./routes/AuthRoute.js";
import documentRoute from "./routes/DocumentRoute.js";
import Document from "./models/Document.js";
import { addToSharedTo } from "./controllers/DocumentController.js";

dotenv.config();

const app = express();
app.use(
    cors({
        origin: ["https://collab-write-delta.vercel.app", "http://localhost:5173"],
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        credentials: true,
    })
);
app.use(cookieParser());
app.use(express.json());

const server = createServer(app);
const PORT = process.env.PORT || 3000;
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
    }
});

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB is  connected successfully"))
    .catch((err) => console.error(err));

// ── Active Room State ──────────────────────────────────────────────────────────
// Map: roomId -> Map(socketId -> username)
const activeRooms = new Map();

// Map: socketId -> { ownerSocketId, docId } (pending join requests)
const pendingRequests = new Map();

function getRoomActiveUsers(roomId) {
    const room = activeRooms.get(roomId);
    if (!room) return [];
    return Array.from(room.values());
}

function addUserToRoom(roomId, socketId, username) {
    if (!activeRooms.has(roomId)) activeRooms.set(roomId, new Map());
    activeRooms.get(roomId).set(socketId, username);
}

function removeUserFromRoom(roomId, socketId) {
    const room = activeRooms.get(roomId);
    if (room) {
        room.delete(socketId);
        if (room.size === 0) activeRooms.delete(roomId);
    }
}

// Helper: find owner socket in a room
async function findOwnerSocket(roomId) {
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
async function broadcastUserLists(roomId) {
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

//IO SECTION
io.on("connection", (socket) => {
    console.log("a user connected");
    console.log("ID : " + socket.id);

    socket.on("disconnect", () => {
        console.log(socket.id + " disconnected");
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit("user-left", socket.username || socket.id);
            removeUserFromRoom(socket.currentRoom, socket.id);
            broadcastUserLists(socket.currentRoom);
        }
    });

    // ── Join Room (direct, for the owner or already-shared users) ─────────────
    socket.on("join-room", async (id, username) => {
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
                socket.emit("load-document", {
                    content: document.content,
                    title: document.title,
                    description: document.description || "",
                    ownerUsername: document.owner.username,
                    ownerId: document.owner._id.toString(),
                });

                // Auto-add to sharedTo if not owner and not already there
                const isOwner = document.owner._id.toString() === socket.userId?.toString();
                if (!isOwner && socket.userId) {
                    await addToSharedTo(id, socket.userId);
                }
            }
        } catch (err) {
            console.error("Error loading document on join:", err);
        }

        await broadcastUserLists(id);
    });

    // ── Request to Join (for new users who aren't in sharedTo yet) ────────────
    // Workflow:
    //   1. New user socket emits "request-join" { docId, username }
    //   2. Server finds owner socket → sends "join-request" to owner
    //   3. Owner approves/denies → emits "respond-join" { requesterId, approved }
    //   4. Server tells requester to proceed or reject

    socket.on("request-join", async ({ docId, username, userId }) => {
        socket.pendingDocId = docId;
        socket.username = username;
        socket.userId = userId;

        try {
            const doc = await Document.findById(docId)
                .populate("owner", "username _id")
                .populate("sharedTo", "_id");

            if (!doc) {
                socket.emit("join-denied", { message: "Document not found" });
                return;
            }

            const isOwner = (userId && doc.owner._id.toString() === userId) ||
                (username && doc.owner.username === username);
            const isAlreadyShared = userId
                ? doc.sharedTo.some(u => u._id.toString() === userId)
                : false;

            // Owner or already-approved user → join directly
            if (isOwner || isAlreadyShared) {
                socket.emit("join-approved", { docId });
                return;
            }

            // Safety net: if userId is missing but the room is empty,
            // the first person to arrive is almost certainly the creator —
            // approve them so a freshly created document is always openable.
            const roomIsEmpty = !activeRooms.has(docId) || activeRooms.get(docId).size === 0;
            if (!userId && roomIsEmpty) {
                socket.emit("join-approved", { docId });
                return;
            }

            // Find owner socket
            const ownerSocket = await findOwnerSocket(docId);

            if (!ownerSocket) {
                // Owner not present — cannot approve, tell requester to wait
                socket.emit("join-pending", {
                    message: "The document owner is not currently online. Please ask them to open the document so they can approve your request.",
                });
                return;
            }

            // Notify owner
            pendingRequests.set(socket.id, { ownerSocketId: ownerSocket.socketId, docId });
            io.to(ownerSocket.socketId).emit("join-request", {
                requesterId: socket.id,
                username,
            });

        } catch (err) {
            console.error("request-join error:", err);
            socket.emit("join-denied", { message: "Server error" });
        }
    });

    // ── Owner responds to join request ────────────────────────────────────────
    socket.on("respond-join", async ({ requesterId, approved, docId }) => {
        const requesterSocket = io.sockets.sockets.get(requesterId);
        if (!requesterSocket) return;

        pendingRequests.delete(requesterId);

        if (approved) {
            // Add to sharedTo
            if (requesterSocket.userId) {
                await addToSharedTo(docId, requesterSocket.userId);
            }
            requesterSocket.emit("join-approved", { docId });
        } else {
            requesterSocket.emit("join-denied", { message: "The owner denied your request." });
        }
    });

    // ── Standard socket events ─────────────────────────────────────────────────
    socket.on("save-document", async (id, content) => {
        try {
            await Document.findByIdAndUpdate(id, { content });
        } catch (err) {
            console.error("Error saving document:", err);
        }
    });

    socket.on("rename-document", async (id, title) => {
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
    });

    socket.on("send-delta", (id, delta) => {
        socket.to(id).emit("receive-delta", delta);
    });

    socket.on("chat-message", (id, username, message) => {
        socket.to(id).emit("receive-chat-message", username, message);
    });

    socket.on("leave-room", (id, username) => {
        console.log(`socket ${socket.id} left room ${id}`);
        socket.to(id).emit("user-left", username || socket.id);
        removeUserFromRoom(id, socket.id);
        socket.leave(id);
        socket.currentRoom = null;
        broadcastUserLists(id);
    });

    // ── Description update via socket (real-time sync to room) ───────────────
    socket.on("update-description", async (docId, description) => {
        try {
            await Document.findByIdAndUpdate(docId, { description });
            // Broadcast new description to everyone in the room
            io.to(docId).emit("description-updated", description);
        } catch (err) {
            console.error("Error updating description:", err);
        }
    });
});

server.listen(PORT, () => {
    console.log("listening on PORT:", PORT);
});

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.use("/", authRoute);
app.use("/documents", documentRoute);