import express from "express";
import { Signup, Login, getData } from "../controllers/AuthController.js";
import { userVerification } from "../middlewares/AuthMiddleware.js";

const router = express.Router();

router.post("/signup", Signup);
router.post("/login", Login);
router.post("/", userVerification);
router.post("/getData", getData);

export default router;