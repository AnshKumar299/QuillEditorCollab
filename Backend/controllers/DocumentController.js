import Document from "../models/Document.js";

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

export const getUserDocuments = async (req, res) => {
    try {
        const documents = await Document.find({ owner: req.user._id })
            .select("_id title updatedAt")
            .sort({ updatedAt: -1 });
        res.status(200).json({ status: true, documents });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error fetching documents" });
    }
};

export const getDocumentById = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await Document.findById(id);
        
        if (!document) {
            return res.status(404).json({ status: false, message: "Document not found" });
        }
        
        // Basic permission check (allow owner for now, could expand to collaborators later)
        if (document.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ status: false, message: "Not authorized to access this document" });
        }
        
        res.status(200).json({ status: true, document });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error fetching document" });
    }
};
