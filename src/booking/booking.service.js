import Booking from "./booking.model.js";
import Business from "../modules/business/business.model.js";
import User from "../modules/auth/auth.model.js";
import ApiError from "../../utils/ApiError.js";

const RATE_PER_MINUTE = 20; // ₹20 per extra minute
const FLEX_WINDOW = 10; // ±10 minutes flexibility
const MAX_DELAY_THRESHOLD = 30; // minutes — beyond this, user can cancel

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
    status: { $nin: ["cancelled"] },
  }).sort({ startTime: 1 });

  // AI: Calculate buffer time based on extension history
  const recentExtensions = await Booking.find({
    businessId,
    extendedTime: { $gt: 0 },
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  });
  const avgExtension = recentExtensions.length > 0
    ? recentExtensions.reduce((sum, b) => sum + b.extendedTime, 0) / recentExtensions.length
    : 0;
  const aiBuffer = Math.round(Math.min(avgExtension, 5)); // max 5 min buffer

  console.log(`🧠 AI Slot Buffer: ${aiBuffer} min (from ${recentExtensions.length} recent extensions)`);

  // Generate available slots
  const slots = [];
  let cursor = new Date(dayStart);

  while (cursor < dayEnd) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(slotStart.getTime() + avgTime * 60000);

    // Check if slot conflicts with any existing booking (with flex window)
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

    // Move cursor: slot duration + AI buffer
    cursor = new Date(cursor.getTime() + (avgTime + aiBuffer) * 60000);
  }

  return { slots, avgServiceTime: avgTime, aiBuffer, ratePerMinute: RATE_PER_MINUTE, maxCapacity: business.maxCapacity || 1 };
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
  pricingLabel 
}, io = null) => {
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  const duration = business.averageServiceTime || 10;
  const reqStart = new Date(startTime);
  const reqEnd = new Date(reqStart.getTime() + duration * 60000);

  // Check for overlapping bookings
  const conflict = await Booking.findOne({
    businessId,
    status: { $nin: ["cancelled"] },
    startTime: { $lt: reqEnd },
    endTime: { $gt: reqStart },
  });

  if (conflict) {
    throw new ApiError(409, "This time slot is not available. Try another time.");
  }

  // Check duplicate booking
  const duplicate = await Booking.findOne({
    businessId,
    userId,
    startTime: reqStart,
    status: { $nin: ["cancelled"] },
  });
  if (duplicate) throw new ApiError(409, "You already have a booking at this time");

  // Wallet Integration: Dynamic Pricing
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  let totalCost = business.basePrice || 0;
  if (pricingLabel) {
    const specificPricing = business.pricing.find(p => p.label === pricingLabel);
    if (specificPricing) totalCost = specificPricing.price;
  }

  if (user.walletBalance < totalCost) throw new ApiError(400, "Insufficient wallet balance for this booking");
  
  user.walletBalance -= totalCost;
  await user.save();

  if (io) {
    io.to(`user:${user._id}`).emit("wallet:update", { balance: user.walletBalance });
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
    pricingLabel,
    paidAmount: totalCost,
  });

  console.log(`📅 Booking created: ${reqStart.toLocaleTimeString()} - ${reqEnd.toLocaleTimeString()} | Wallet -₹${totalCost}`);

  return {
    booking: await booking.populate("userId", "name email avatar"),
    adjusted: false,
    newBalance: user.walletBalance,
  };
};

// ─── Extend Booking ───────────────────────────────────────────
export const extendBooking = async (bookingId, extraMinutes, io) => {
  const booking = await Booking.findById(bookingId).populate("userId", "name email");
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.status === "cancelled") throw new ApiError(400, "Cannot extend a cancelled booking");
  if (booking.status === "completed") throw new ApiError(400, "Cannot extend a completed booking");

  // Input validation
  const mins = Number(extraMinutes);
  if (!Number.isFinite(mins) || mins < 1 || mins > 60) {
    throw new ApiError(400, "Extension must be 1-60 minutes");
  }

  const extraMs = mins * 60000;
  const extraCharge = mins * RATE_PER_MINUTE;

  // ⚠️ Capture original endTime BEFORE mutation
  const originalEndTime = new Date(booking.endTime);

  // Update current booking
  booking.endTime = new Date(booking.endTime.getTime() + extraMs);
  booking.extendedTime += mins;
  booking.duration += mins;
  await booking.save();

  console.log(`⏱️ Booking extended: +${mins}min`);

  // Shift all future bookings
  const futureBookings = await Booking.find({
    businessId: booking.businessId,
    startTime: { $gte: originalEndTime },
    status: { $nin: ["cancelled", "completed"] },
  }).sort({ startTime: 1 }).populate("userId", "name email");

  const affectedUsers = [];

  for (const fb of futureBookings) {
    fb.startTime = new Date(fb.startTime.getTime() + extraMs);
    fb.endTime = new Date(fb.endTime.getTime() + extraMs);
    fb.delayMinutes += mins;

    // 💰 COMPENSATION REWARD (Add directly to wallet)
    const rewardAmount = 15; // ₹15 for appointment delay
    const affectedUser = await User.findById(fb.userId._id);
    affectedUser.walletBalance += rewardAmount;
    await affectedUser.save();
    
    if (io) {
      io.to(`user:${fb.userId._id}`).emit("wallet:update", { balance: affectedUser.walletBalance });
    }

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

  console.log(`📊 ${affectedUsers.length} bookings shifted and users rewarded.`);

  // Emit Socket.IO notifications to affected users
  if (io && affectedUsers.length > 0) {
    for (const affected of affectedUsers) {
      io.emit("booking:delayed", {
        userId: affected.userId,
        message: `Your booking is delayed by ${mins} minutes. We've credited ₹${affected.reward} to your wallet as a reward!`,
        newStartTime: affected.newStartTime,
        newEndTime: affected.newEndTime,
        reward: affected.reward,
      });
    }
  }

  return {
    booking,
    affectedUsers,
  };
};

// ─── Accept / Cancel Delay ────────────────────────────────────
export const respondToDelay = async (bookingId, userId, accept, io = null) => {
  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) throw new ApiError(404, "Booking not found");

  if (accept) {
    booking.delayAccepted = true;
    await booking.save();
    console.log(`✅ Delay accepted for booking ${bookingId}`);
    return { booking, action: "accepted" };
  } else {
    // 💰 Refund directly to wallet
    const refundAmount = booking.paidAmount || 0;
    const compensation = 25; // Extra 25 for appointment delay cancellation
    const totalRefund = refundAmount + compensation;

    const user = await User.findById(userId);
    if (user) {
      user.walletBalance += totalRefund;
      await user.save();
      
      if (io) {
        io.to(`user:${userId}`).emit("wallet:update", { balance: user.walletBalance });
      }
    }

    booking.status = "cancelled";
    booking.delayAccepted = false;
    await booking.save();
    
    console.log(`❌ Booking ${bookingId} cancelled due to delay | Refunded ₹${totalRefund}`);
    return { booking, action: "cancelled", refunded: totalRefund };
  }
};

// ─── Start Service ────────────────────────────────────────────
export const startService = async (bookingId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.status !== "scheduled") throw new ApiError(400, "Can only start scheduled bookings");

  booking.status = "in-progress";
  await booking.save();
  return booking;
};

// ─── Complete Service ─────────────────────────────────────────
export const completeService = async (bookingId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.status !== "in-progress") throw new ApiError(400, "Can only complete in-progress bookings");

  booking.status = "completed";
  await booking.save();
  return booking;
};

// ─── Get Queries ──────────────────────────────────────────────
export const getMyBookings = async (userId) => {
  return await Booking.find({ userId, status: { $nin: ["cancelled"] } })
    .populate("businessId", "name category address averageServiceTime")
    .sort({ startTime: 1 });
};

export const getBusinessBookings = async (businessId) => {
  return await Booking.find({
    businessId,
    status: { $nin: ["cancelled"] },
    startTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // last 24h+
  })
    .populate("userId", "name email avatar")
    .sort({ startTime: 1 });
};

export const cancelBooking = async (bookingId, userId) => {
  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.status === "cancelled") throw new ApiError(400, "Already cancelled");
  booking.status = "cancelled";
  return await booking.save();
};
