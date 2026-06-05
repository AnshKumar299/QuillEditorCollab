import Document from "../models/Document.js";
import { getValidObjectId } from "../util/crypto.js";
import { pendingRequests } from "./state.js";
import { findOwnerSocket } from "./roomManager.js";
import { addToSharedTo } from "../controllers/DocumentController.js";

// Workflow:
//   1. New user socket emits "request-join" { docId, username }
//   2. Server finds owner socket → sends "join-request" to owner
//   3. Owner approves/denies → emits "respond-join" { requesterId, approved }
//   4. Server tells requester to proceed or reject
export async function handleRequestJoin(io, socket, { docId: rawDocId, username, userId }) {
    const docId = getValidObjectId(rawDocId);
    if (!docId) return;

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

        const isOwner = (userId && doc.owner && doc.owner._id && doc.owner._id.toString() === userId.toString()) ||
            (username && doc.owner && doc.owner.username === username);
        const isAlreadyShared = userId
            ? doc.sharedTo.some(user => user && user._id && user._id.toString() === userId.toString())
            : false;

        // Owner or already-approved user → join directly
        if (isOwner || isAlreadyShared) {
            socket.emit("join-approved", { docId: rawDocId });
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
}

export async function handleRespondJoin(io, socket, { requesterId, approved, docId: rawDocId }) {
    const docId = getValidObjectId(rawDocId);
    if (!docId) return;

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
}
