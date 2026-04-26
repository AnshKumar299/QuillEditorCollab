import express from "express";
import { createDocument, getUserDocuments, getDocumentById } from "../controllers/DocumentController.js";
import { requireAuth } from "../middlewares/RequireAuth.js";

const router = express.Router();

// Apply requireAuth middleware to all document routes
router.use(requireAuth);

router.post("/create", createDocument);
router.get("/list", getUserDocuments);
router.get("/:id", getDocumentById);

export default router;
