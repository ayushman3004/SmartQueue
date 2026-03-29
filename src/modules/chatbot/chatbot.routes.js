import express from "express";
import * as chatbotController from "./chatbot.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/chat", chatbotController.chat);

export default router;
