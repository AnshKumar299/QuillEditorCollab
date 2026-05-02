import Document from "../models/Document.js";
import User from "../models/UserModel.js";
import mongoose from "mongoose";

// Create a new document
export const createDocument = async (req, res) => {
    try {
        const { title } = req.body;
        const newDoc = await Document.create({
            owner: req.user._id,
            title: title || "Untitled Document",
        });
        res.status(201).json({ status: true, document: newDoc });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error creating document" });
    }
};

// Get owned + shared documents for the current user
export const getUserDocuments = async (req, res) => {
    try {
        const userId = req.user._id;

        const [ownedDocs, sharedDocs] = await Promise.all([
            Document.find({ owner: userId })
                .select("_id title description updatedAt")
                .sort({ updatedAt: -1 }),
            Document.find({ sharedTo: userId })
                .select("_id title description updatedAt owner")
                .populate("owner", "username")
                .sort({ updatedAt: -1 }),
        ]);

        res.status(200).json({ status: true, ownedDocuments: ownedDocs, sharedDocuments: sharedDocs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error fetching documents" });
    }
};

// Get a specific document by ID (owner or sharedTo user)
export const getDocumentById = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await Document.findById(id).populate("owner", "username _id");

        if (!document) {
            return res.status(404).json({ status: false, message: "Document not found" });
        }

        const isOwner = document.owner._id.toString() === req.user._id.toString();
        const isShared = document.sharedTo.some(uid => uid.toString() === req.user._id.toString());

        if (!isOwner && !isShared) {
            return res.status(403).json({ status: false, message: "Not authorized to access this document" });
        }

        res.status(200).json({
            status: true,
            document,
            isOwner,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error fetching document" });
    }
};

// Check if a document exists by ID (no auth check, just existence)
export const checkDocumentExists = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await Document.findById(id).select("_id");
        res.status(200).json({ status: true, exists: !!doc });
    } catch (err) {
        // Invalid ObjectId or DB error — treat as not found
        res.status(200).json({ status: true, exists: false });
    }
};

// Share document with a user by email (owner-only)
export const shareDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ status: false, message: "Email is required" });
        }

        const document = await Document.findById(id);
        if (!document) {
            return res.status(404).json({ status: false, message: "Document not found" });
        }

        if (document.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ status: false, message: "Only the owner can share this document" });
        }

        const targetUser = await User.findOne({ email });
        if (!targetUser) {
            return res.status(404).json({ status: false, message: "No user found with that email" });
        }

        if (targetUser._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ status: false, message: "You cannot share a document with yourself" });
        }

        // Add to sharedTo if not already there
        if (!document.sharedTo.some(uid => uid.toString() === targetUser._id.toString())) {
            document.sharedTo.push(targetUser._id);
            await document.save();
        }

        res.status(200).json({ status: true, message: `Document shared with ${targetUser.username}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error sharing document" });
    }
};

// Update document description (owner-only)
export const updateDescription = async (req, res) => {
    try {
        const { id } = req.params;
        const { description } = req.body;

        const document = await Document.findById(id);
        if (!document) {
            return res.status(404).json({ status: false, message: "Document not found" });
        }

        if (document.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ status: false, message: "Only the owner can edit the description" });
        }

        document.description = description ?? "";
        await document.save();

        res.status(200).json({ status: true, message: "Description updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error updating description" });
    }
};

// Add user to sharedTo list (called internally from socket after approval)
// Also exported so socket can use it
export const addToSharedTo = async (documentId, userId) => {
    try {
        if (!userId) return;
        // Explicitly cast to ObjectId to ensure Mongoose query works correctly
        let userObjectId;
        try {
            userObjectId = new mongoose.Types.ObjectId(userId.toString());
        } catch {
            console.error("addToSharedTo: invalid userId", userId);
            return;
        }
        const result = await Document.updateOne(
            { _id: documentId, sharedTo: { $ne: userObjectId } },
            { $push: { sharedTo: userObjectId } }
        );
        console.log(`addToSharedTo: doc=${documentId} user=${userObjectId} modified=${result.modifiedCount}`);
    } catch (err) {
        console.error("Error adding user to sharedTo:", err);
    }
};
