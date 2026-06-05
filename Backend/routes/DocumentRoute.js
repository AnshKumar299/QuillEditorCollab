import express from "express";
import {
    createDocument,
    getUserDocuments,
    getDocumentById,
    checkDocumentExists,
    shareDocument,
    updateDescription,
    deleteDocument,
    getUserSettings,
    updateUserSettings,
    copyDocument,
} from "../controllers/DocumentController.js";
import { requireAuth } from "../middlewares/RequireAuth.js";
import { getValidObjectId } from "../util/crypto.js";

const router = express.Router();

router.param("id", (req, res, next, id) => {
    const validId = getValidObjectId(id);
    if (!validId) {
        return res.status(400).json({ status: false, message: "Invalid Document ID format" });
    }
    req.params.id = validId;
    next();
});

// Public existence check (no auth needed — just checks if doc ID exists)
router.get("/check/:id", checkDocumentExists);

// All other routes require auth
router.use(requireAuth);

router.post("/create", createDocument);
router.get("/list", getUserDocuments);
router.get("/settings/get", getUserSettings);
router.post("/settings/update", updateUserSettings);
router.post("/:id/copy", copyDocument);
router.get("/:id", getDocumentById);
router.delete("/:id", deleteDocument);
router.post("/:id/share", shareDocument);
router.patch("/:id/description", updateDescription);

export default router;
