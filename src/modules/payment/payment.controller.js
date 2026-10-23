import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import Booking from "../../booking/booking.model.js";
import Business from "../business/business.model.js";
import {
  getPublicPaymentConfig,
  createRazorpayOrderForBooking,
  verifyPaymentSignature,
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

  // Cryptographically verify signature
  const isSignatureValid = verifyPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  if (!isSignatureValid) {
    booking.paymentStatus = "failed";
    booking.paymentFailureReason = "Signature mismatch";
    await booking.save();
    throw new ApiError(400, "Payment verification failed: Invalid signature");
  }

  // Update booking as confirmed and paid
  booking.paymentStatus = "paid";
  booking.status = "confirmed";
  booking.paymentMethod = "online";
  booking.razorpayPaymentId = razorpayPaymentId;
  booking.razorpaySignature = razorpaySignature;
  booking.paidAt = new Date();
  booking.paidAmount = booking.amount || booking.paidAmount;
  await booking.save();

  const io = req.app.get("io");
  if (io) {
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

  // If webhook secret is set, verify signature
  if (process.env.RAZORPAY_WEBHOOK_SECRET) {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn("🚫 Invalid Razorpay webhook signature");
      throw new ApiError(400, "Invalid webhook signature");
    }
  }

  const io = req.app.get("io");
  const result = await processWebhookEvent(req.body, io);

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
    // If setting to ONLINE or BOTH, verify that online status is ACTIVE or PENDING
    if (
      ["ONLINE", "BOTH"].includes(paymentMode) &&
      business.paymentConfiguration?.onlinePaymentStatus !== "ACTIVE"
    ) {
      // In development/test mode allow setting, but warn
      business.paymentConfiguration.paymentMode = paymentMode;
    } else {
      business.paymentConfiguration.paymentMode = paymentMode;
    }
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
