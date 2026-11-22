import express from "express";
import * as chatbotController from "./chatbot.controller.js";
import { optionalAuth } from "../../../middleware/auth.middleware.js";
import { chatbotLimit } from "../../gateway/endpointRateLimits.js";

const router = express.Router();

router.use(optionalAuth);

router.post("/chat", chatbotLimit, chatbotController.chat);

export default router;
