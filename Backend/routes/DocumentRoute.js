import express from "express";
import {
    createDocument,
    getUserDocuments,
    getDocumentById,
    checkDocumentExists,
    shareDocument,
    updateDescription,
} from "../controllers/DocumentController.js";
import { requireAuth } from "../middlewares/RequireAuth.js";

const router = express.Router();

// Public existence check (no auth needed — just checks if doc ID exists)
router.get("/check/:id", checkDocumentExists);

// All other routes require auth
router.use(requireAuth);

router.post("/create", createDocument);
router.get("/list", getUserDocuments);
router.get("/:id", getDocumentById);
router.post("/:id/share", shareDocument);
router.patch("/:id/description", updateDescription);

export default router;
