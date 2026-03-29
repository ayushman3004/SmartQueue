import * as bookingService from "./booking.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";

// GET /api/bookings/slots/:businessId?date=2026-03-27
export const getSlots = asyncHandler(async (req, res) => {
  const date = req.query.date || new Date().toISOString().split("T")[0];
  const result = await bookingService.getAvailableSlots(req.params.businessId, date);
  res.json(new ApiResponse(200, result));
});

// POST /api/bookings
export const book = asyncHandler(async (req, res) => {
  const { businessId, startTime, serviceType, notes, pricingLabel } = req.body;
  if (!businessId || !startTime) throw new ApiError(400, "businessId and startTime are required");
  if (isNaN(new Date(startTime).getTime())) throw new ApiError(400, "Invalid startTime format");

  const io = req.app.get("io");
  const result = await bookingService.createBooking({
    businessId,
    userId: req.user._id,
    startTime,
    serviceType,
    notes,
    pricingLabel,
  }, io);
  const message = result.adjusted
    ? `Booking confirmed (adjusted to ${new Date(result.booking.startTime).toLocaleTimeString()})`
    : "Booking confirmed!";
  res.status(201).json(new ApiResponse(201, result, message));
});

// POST /api/bookings/extend/:id
export const extend = asyncHandler(async (req, res) => {
  const { extraMinutes } = req.body;
  if (extraMinutes == null) throw new ApiError(400, "extraMinutes is required");

  const io = req.app.get("io");
  const result = await bookingService.extendBooking(req.params.id, extraMinutes, io);
  res.json(
    new ApiResponse(200, result, `Extended by ${extraMinutes} min. Extra charge: ₹${result.extraCharge}`)
  );
});

// POST /api/bookings/:id/respond
export const respondDelay = asyncHandler(async (req, res) => {
  const { accept } = req.body;
  const io = req.app.get("io");
  const result = await bookingService.respondToDelay(req.params.id, req.user._id, accept, io);
  const msg = result.action === "cancelled" ? `Delay rejected & refunded ₹${result.refunded}` : `Delay accepted`;
  res.json(new ApiResponse(200, result, msg));
});

// PATCH /api/bookings/:id/start
export const startService = asyncHandler(async (req, res) => {
  const booking = await bookingService.startService(req.params.id);
  const io = req.app.get("io");
  if (io) io.to(`business:${booking.businessId}`).emit("bookings:updated");
  res.json(new ApiResponse(200, { booking }, "Service started"));
});

// PATCH /api/bookings/:id/complete
export const completeService = asyncHandler(async (req, res) => {
  const booking = await bookingService.completeService(req.params.id);
  const io = req.app.get("io");
  if (io) io.to(`business:${booking.businessId}`).emit("bookings:updated");
  res.json(new ApiResponse(200, { booking }, "Service completed"));
});

// GET /api/bookings/mine
export const myBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getMyBookings(req.user._id);
  res.json(new ApiResponse(200, { bookings }));
});

// GET /api/bookings/:businessId/all
export const businessBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getBusinessBookings(req.params.businessId);
  res.json(new ApiResponse(200, { bookings }));
});

// PATCH /api/bookings/:id/cancel
export const cancel = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { booking }, "Booking cancelled"));
});
