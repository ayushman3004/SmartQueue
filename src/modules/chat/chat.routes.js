import express from "express";
import * as chatController from "./chat.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/send", chatController.sendMessage);
router.get("/:bookingId", chatController.getBookingChat);

export default router;
