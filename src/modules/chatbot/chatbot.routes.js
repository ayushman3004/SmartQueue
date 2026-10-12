import express from "express";
import * as chatbotController from "./chatbot.controller.js";
import { optionalAuth } from "../../../middleware/auth.middleware.js";

const router = express.Router();

router.use(optionalAuth);

router.post("/chat", chatbotController.chat);

export default router;
