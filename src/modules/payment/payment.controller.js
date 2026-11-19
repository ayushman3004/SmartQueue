import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import Booking from "../../booking/booking.model.js";
import Business from "../business/business.model.js";
import {
  getPublicPaymentConfig,
  isRazorpayConfigured,
  createRazorpayOrderForBooking,
  confirmRazorpayPaymentForBooking,
  verifyWebhookSignature,
  connectRazorpayRouteAccount,
  processWebhookEvent,
} from "./razorpay.service.js";

/**
 * Public configuration endpoint for Razorpay Checkout
 */
export const getPaymentConfig = asyncHandler(async (_req, res) => {
  const config = getPublicPaymentConfig();
  res.json(new ApiResponse(200, config, "Payment configuration retrieved"));
});

/**
 * Create a Razorpay Order for a specific Booking
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) {
    throw new ApiError(400, "bookingId is required");
  }

  const order = await createRazorpayOrderForBooking(bookingId, req.user._id);
  res.status(201).json(new ApiResponse(201, { order }, "Razorpay order created"));
});

/**
 * Verify Razorpay payment signature and securely confirm booking
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!bookingId || !razorpayOrderId || !razorpayPaymentId) {
    throw new ApiError(400, "Missing required payment verification details");
  }

  const booking = await Booking.findById(bookingId).populate("businessId");
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not authorized to verify payment for this booking");
  }

  const changed = await confirmRazorpayPaymentForBooking(booking, { razorpayOrderId, razorpayPaymentId, razorpaySignature });

  const io = req.app.get("io");
  if (io && changed) {
    io.to(`business:${booking.businessId._id || booking.businessId}`).emit("bookings:updated");
    io.to(`user:${booking.userId}`).emit("booking:confirmed", { booking });
  }

  res.json(
    new ApiResponse(
      200,
      {
        booking,
        paymentStatus: "paid",
        paidAmount: booking.paidAmount,
      },
      "Payment verified and booking confirmed"
    )
  );
});

/**
 * Razorpay Webhook Handler
 */
export const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  if (!verifyWebhookSignature(req.rawBody, signature)) throw new ApiError(400, "Invalid webhook signature or missing raw payload");
  let event;
  try { event = JSON.parse(req.rawBody.toString("utf8")); }
  catch { throw new ApiError(400, "Invalid webhook JSON"); }

  const io = req.app.get("io");
  const result = await processWebhookEvent(event, io);

  res.status(200).json({ status: "ok", result });
});

/**
 * Connect or initiate Razorpay Route linked account for business
 */
export const connectRouteAccount = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  if (
    req.user.role !== "admin" &&
    business.owner.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "Not authorized to configure payments for this business");
  }

  const result = await connectRazorpayRouteAccount(businessId, req.user, req.body);
  res.json(new ApiResponse(200, result, "Payment account configuration updated"));
});

/**
 * Get business payment configuration and Route status
 */
export const getBusinessPaymentStatus = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  res.json(
    new ApiResponse(
      200,
      {
        paymentConfiguration: business.paymentConfiguration,
        isOnlineEligible:
          isRazorpayConfigured() &&
          /^acc_[A-Za-z0-9]+$/.test(business.paymentConfiguration?.providerAccountReference || "") &&
          business.paymentConfiguration?.onlinePaymentStatus === "ACTIVE" &&
          ["ONLINE", "BOTH"].includes(business.paymentConfiguration?.paymentMode),
      },
      "Payment configuration retrieved"
    )
  );
});

/**
 * Update business payment modes (Pay at Business, Online, Both)
 */
export const updatePaymentModes = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { paymentMode, upiId } = req.body;

  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  if (
    req.user.role !== "admin" &&
    business.owner.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "Not authorized to configure payments for this business");
  }

  if (paymentMode && ["PAY_AT_BUSINESS", "ONLINE", "BOTH"].includes(paymentMode)) {
    if (["ONLINE", "BOTH"].includes(paymentMode) &&
        (!isRazorpayConfigured() || business.paymentConfiguration?.onlinePaymentStatus !== "ACTIVE" ||
         !/^acc_[A-Za-z0-9]+$/.test(business.paymentConfiguration?.providerAccountReference || ""))) {
      throw new ApiError(409, "Online payments require a configured and verified payment account");
    }
    business.paymentConfiguration.paymentMode = paymentMode;
  }

  if (upiId !== undefined) {
    business.paymentConfiguration.upiId = upiId;
  }

  await business.save();

  res.json(
    new ApiResponse(
      200,
      { paymentConfiguration: business.paymentConfiguration },
      "Payment modes updated successfully"
    )
  );
});
