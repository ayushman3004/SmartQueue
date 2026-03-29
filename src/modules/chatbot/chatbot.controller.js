import * as chatbotService from "./chatbot.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

export const chat = asyncHandler(async (req, res) => {
  const { message, businessInfo } = req.body;
  const result = await chatbotService.processMessage(message, businessInfo);
  res.json(new ApiResponse(200, result, "Chat processed successfully"));
});
