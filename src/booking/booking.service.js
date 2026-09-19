import Booking from "./booking.model.js";
import Business from "../modules/business/business.model.js";
import User from "../modules/auth/auth.model.js";
import ApiError from "../../utils/ApiError.js";
import { deductWalletBalance, refundToWallet } from "../modules/payment/payment.service.js";
import { validateCoupon } from "../modules/coupon/coupon.service.js";

const RATE_PER_MINUTE = 20; // ₹20 per extra minute
const FLEX_WINDOW = 10; // ±10 minutes flexibility

// ─── Available Slots ──────────────────────────────────────────
export const getAvailableSlots = async (businessId, date) => {
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  const avgTime = business.averageServiceTime || 10;

  // Build the day window (9 AM - 6 PM)
  const dayStart = new Date(date);
  dayStart.setHours(9, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(18, 0, 0, 0);

  // Get all active bookings for the day
  const bookings = await Booking.find({
    businessId,
    startTime: { $gte: dayStart, $lt: dayEnd },
    status: { $nin: ["cancelled", "refunded"] },
  }).sort({ startTime: 1 });

  // Buffer calculation based on recent extensions
  const recentExtensions = await Booking.find({
    businessId,
    extendedTime: { $gt: 0 },
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  });
  const avgExtension = recentExtensions.length > 0
    ? recentExtensions.reduce((sum, b) => sum + b.extendedTime, 0) / recentExtensions.length
    : 0;
  const aiBuffer = Math.round(Math.min(avgExtension, 5)); // max 5 min buffer

  // Generate available slots
  const slots = [];
  let cursor = new Date(dayStart);

  while (cursor < dayEnd) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(slotStart.getTime() + avgTime * 60000);

    const hasConflict = bookings.some((b) => {
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      const sStart = slotStart.getTime();
      const sEnd = slotEnd.getTime();
      return sStart < bEnd && sEnd > bStart;
    });

    slots.push({
      startTime: slotStart.toISOString(),
      endTime: slotEnd.toISOString(),
      duration: avgTime,
      available: !hasConflict,
      flexRange: {
        earliest: new Date(slotStart.getTime() - FLEX_WINDOW * 60000).toISOString(),
        latest: new Date(slotStart.getTime() + FLEX_WINDOW * 60000).toISOString(),
      },
    });

    cursor = new Date(cursor.getTime() + (avgTime + aiBuffer) * 60000);
  }

  return {
    slots,
    avgServiceTime: avgTime,
    aiBuffer,
    ratePerMinute: RATE_PER_MINUTE,
    maxCapacity: business.maxCapacity || 1,
  };
};

// ─── Create Booking ───────────────────────────────────────────
export const createBooking = async ({
  businessId,
  userId,
  startTime,
  serviceType,
  notes,
  isGroupBooking,
  guestCount,
  pricingLabel,
  couponCode,
}, io = null) => {
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  const duration = business.averageServiceTime || 10;
  const reqStart = new Date(startTime);
  const reqEnd = new Date(reqStart.getTime() + duration * 60000);

  // Check for overlapping bookings
  const conflict = await Booking.findOne({
    businessId,
    status: { $nin: ["cancelled", "refunded"] },
    startTime: { $lt: reqEnd },
    endTime: { $gt: reqStart },
  });

  if (conflict) {
    throw new ApiError(409, "This time slot is no longer available. Please select another slot.");
  }

  // Check duplicate booking for the user
  const duplicate = await Booking.findOne({
    businessId,
    userId,
    startTime: reqStart,
    status: { $nin: ["cancelled", "refunded"] },
  });
  if (duplicate) throw new ApiError(409, "You already have an active booking at this time.");

  // Calculate pricing
  let totalCost = business.basePrice || 0;
  if (pricingLabel) {
    const specificPricing = business.pricing?.find((p) => p.label === pricingLabel);
    if (specificPricing) totalCost = specificPricing.price;
  }
  const matchedService = business.services?.find((s) => s.name === serviceType);
  if (matchedService && matchedService.price !== undefined) {
    totalCost = matchedService.price;
  }

  // Apply Coupon if provided
  let discount = 0;
  if (couponCode) {
    try {
      const couponValidation = await validateCoupon(couponCode, userId, businessId);
      if (couponValidation.valid) {
        discount = couponValidation.discountAmount;
      }
    } catch (err) {
      console.warn("Coupon application skipped:", err.message);
    }
  }

  const finalAmount = Math.max(0, totalCost - discount);

  // Atomic deduction from wallet
  let newBalance = 0;
  if (finalAmount > 0) {
    newBalance = await deductWalletBalance(
      userId,
      finalAmount,
      `Booking at ${business.name}`,
      io
    );
  } else {
    const user = await User.findById(userId);
    newBalance = user?.walletBalance || 0;
  }

  const booking = await Booking.create({
    businessId,
    userId,
    startTime: reqStart,
    endTime: reqEnd,
    duration,
    serviceType: serviceType || "general",
    isGroupBooking: !!isGroupBooking,
    guestCount: guestCount || 1,
    notes,
    pricingLabel: pricingLabel || serviceType || "standard",
    paidAmount: finalAmount,
    status: "confirmed",
  });

  if (io) {
    io.to(`business:${businessId}`).emit("bookings:updated");
    io.to(`user:${userId}`).emit("booking:confirmed", { booking });
  }

  return {
    booking: await booking.populate("userId", "name email avatar"),
    adjusted: false,
    newBalance,
  };
};

// ─── Extend Booking ───────────────────────────────────────────
export const extendBooking = async (bookingId, extraMinutes, requesterId, requesterRole, io) => {
  const booking = await Booking.findById(bookingId).populate("userId", "name email");
  if (!booking) throw new ApiError(404, "Booking not found");

  const business = await Business.findById(booking.businessId);
  if (requesterRole !== "admin" && (!business || business.owner.toString() !== requesterId.toString())) {
    throw new ApiError(403, "Access denied: you can only extend bookings for your own business");
  }

  if (["cancelled", "refunded"].includes(booking.status)) throw new ApiError(400, "Cannot extend a cancelled booking");
  if (booking.status === "completed") throw new ApiError(400, "Cannot extend a completed booking");

  const mins = Number(extraMinutes);
  if (!Number.isFinite(mins) || mins < 1 || mins > 60) {
    throw new ApiError(400, "Extension must be 1-60 minutes");
  }

  const extraMs = mins * 60000;
  const originalEndTime = new Date(booking.endTime);

  booking.endTime = new Date(booking.endTime.getTime() + extraMs);
  booking.extendedTime += mins;
  booking.duration += mins;
  await booking.save();

  // Shift all future bookings
  const futureBookings = await Booking.find({
    businessId: booking.businessId,
    startTime: { $gte: originalEndTime },
    status: { $nin: ["cancelled", "completed", "refunded"] },
  }).sort({ startTime: 1 }).populate("userId", "name email");

  const affectedUsers = [];

  for (const fb of futureBookings) {
    fb.startTime = new Date(fb.startTime.getTime() + extraMs);
    fb.endTime = new Date(fb.endTime.getTime() + extraMs);
    fb.delayMinutes += mins;
    fb.status = "delayed";

    // Compensation reward
    const rewardAmount = 15;
    await refundToWallet(fb.userId._id, rewardAmount, "Appointment delay compensation", io);
    await fb.save();

    affectedUsers.push({
      userId: fb.userId._id,
      name: fb.userId.name,
      newStartTime: fb.startTime,
      newEndTime: fb.endTime,
      totalDelay: fb.delayMinutes,
      reward: rewardAmount,
    });
  }

  if (io) {
    io.to(`business:${booking.businessId}`).emit("bookings:updated");
    for (const affected of affectedUsers) {
      io.to(`user:${affected.userId}`).emit("booking:delayed", {
        userId: affected.userId,
        message: `Your appointment is delayed by ${mins} minutes. We've credited ₹${affected.reward} to your wallet.`,
        newStartTime: affected.newStartTime,
        newEndTime: affected.newEndTime,
        reward: affected.reward,
      });
    }
  }

  return { booking, affectedUsers };
};

// ─── Accept / Reject Delay ────────────────────────────────────
export const respondToDelay = async (bookingId, userId, accept, io = null) => {
  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) throw new ApiError(404, "Booking not found");

  if (accept) {
    booking.delayAccepted = true;
    booking.status = "confirmed";
    await booking.save();
    return { booking, action: "accepted" };
  } else {
    const refundAmount = booking.paidAmount || 0;
    const compensation = 25;
    const totalRefund = refundAmount + compensation;

    if (totalRefund > 0) {
      await refundToWallet(userId, totalRefund, "Booking delay rejection refund + compensation", io);
    }

    booking.status = "cancelled";
    booking.delayAccepted = false;
    await booking.save();

    if (io) {
      io.to(`business:${booking.businessId}`).emit("bookings:updated");
    }

    return { booking, action: "cancelled", refunded: totalRefund };
  }
};

// ─── Start Service ────────────────────────────────────────────
export const startService = async (bookingId, requesterId, requesterRole) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found");

  const business = await Business.findById(booking.businessId);
  if (requesterRole !== "admin" && (!business || business.owner.toString() !== requesterId.toString())) {
    throw new ApiError(403, "Access denied: you can only start services for your own business");
  }

  if (!["scheduled", "confirmed", "waiting"].includes(booking.status)) {
    throw new ApiError(400, `Cannot start service from '${booking.status}' status`);
  }

  booking.status = "serving";
  await booking.save();
  return booking;
};

// ─── Complete Service ─────────────────────────────────────────
export const completeService = async (bookingId, requesterId, requesterRole) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found");

  const business = await Business.findById(booking.businessId);
  if (requesterRole !== "admin" && (!business || business.owner.toString() !== requesterId.toString())) {
    throw new ApiError(403, "Access denied: you can only complete services for your own business");
  }

  if (!["serving", "in-progress"].includes(booking.status)) {
    throw new ApiError(400, `Cannot complete service from '${booking.status}' status`);
  }

  booking.status = "completed";
  await booking.save();
  return booking;
};

// ─── Queries & Cancel ─────────────────────────────────────────
export const getMyBookings = async (userId) => {
  return await Booking.find({ userId })
    .populate("businessId", "name category address location phone averageServiceTime")
    .sort({ startTime: -1 });
};

export const getBusinessBookings = async (businessId, requesterId, requesterRole) => {
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  if (requesterRole !== "admin" && business.owner.toString() !== requesterId.toString()) {
    throw new ApiError(403, "Access denied: not the owner of this business");
  }

  return await Booking.find({ businessId })
    .populate("userId", "name email avatar phone")
    .sort({ startTime: 1 });
};

export const cancelBooking = async (bookingId, userId, io = null) => {
  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (["cancelled", "refunded"].includes(booking.status)) {
    throw new ApiError(400, "Booking is already cancelled");
  }
  if (booking.status === "completed") {
    throw new ApiError(400, "Cannot cancel a completed booking");
  }

  // Safe refund of paid amount to wallet
  const refundAmount = booking.paidAmount || 0;
  if (refundAmount > 0) {
    await refundToWallet(userId, refundAmount, "Booking cancellation refund", io);
    booking.status = "refunded";
  } else {
    booking.status = "cancelled";
  }

  await booking.save();

  if (io) {
    io.to(`business:${booking.businessId}`).emit("bookings:updated");
  }

  return { booking, refunded: refundAmount };
};
