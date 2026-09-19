import Chat from "./chat.model.js";
import Booking from "../../booking/booking.model.js";
import Business from "../business/business.model.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";

const verifyBookingParticipant = async (bookingId, userId, userRole) => {
  if (userRole === "admin") return true;

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found");

  const isCustomer = booking.userId.toString() === userId.toString();
  if (isCustomer) return true;

  const business = await Business.findById(booking.businessId);
  const isOwner = business && business.owner.toString() === userId.toString();
  if (isOwner) return true;

  throw new ApiError(403, "Access denied: you are not authorized to access this booking's chat");
};

export const sendMessage = asyncHandler(async (req, res) => {
  const { bookingId, receiver, content, messageType } = req.body;
  if (!bookingId || !content) {
    throw new ApiError(400, "bookingId and content are required");
  }

  await verifyBookingParticipant(bookingId, req.user._id, req.user.role);

  const chat = await Chat.create({
    bookingId,
    sender: req.user._id,
    receiver,
    content,
    messageType: messageType || "text",
  });

  const io = req.app.get("io");
  if (io) {
    io.to(`booking:${bookingId}`).emit("chat:message", chat);
  }

  res.status(201).json(new ApiResponse(201, { chat }, "Message sent"));
});

export const getBookingChat = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  await verifyBookingParticipant(bookingId, req.user._id, req.user.role);

  const chats = await Chat.find({ bookingId })
    .populate("sender", "name avatar")
    .sort({ createdAt: 1 });

  res.json(new ApiResponse(200, { chats }, "Chat history retrieved"));
});
