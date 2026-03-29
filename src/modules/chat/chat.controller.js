import Chat from "./chat.model.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

export const sendMessage = asyncHandler(async (req, res) => {
  const { bookingId, receiver, content, messageType } = req.body;
  const chat = await Chat.create({ bookingId, sender: req.user._id, receiver, content, messageType });
  res.json(new ApiResponse(201, { chat }, "Message sent"));
});

export const getBookingChat = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const chats = await Chat.find({ bookingId }).sort({ createdAt: 1 });
  res.json(new ApiResponse(200, { chats }, "Chat history retrieved"));
});
