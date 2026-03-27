import Booking from "./booking.model.js";
import Business from "../modules/business/business.model.js";
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

  return { slots, avgServiceTime: avgTime, aiBuffer, ratePerMinute: RATE_PER_MINUTE };
};

// ─── Create Booking ───────────────────────────────────────────
export const createBooking = async ({ businessId, userId, startTime, serviceType, notes }) => {
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
    // Try flexible booking within ±10 minutes
    const flexStart = new Date(reqStart.getTime() - FLEX_WINDOW * 60000);
    const flexEnd = new Date(reqStart.getTime() + FLEX_WINDOW * 60000);

    // Find the nearest available slot
    const nearbyBookings = await Booking.find({
      businessId,
      status: { $nin: ["cancelled"] },
      startTime: { $gte: flexStart, $lte: flexEnd },
    }).sort({ endTime: 1 });

    // Try right after the last conflicting booking
    if (nearbyBookings.length > 0) {
      const lastEnd = new Date(Math.max(...nearbyBookings.map((b) => new Date(b.endTime).getTime())));
      if (lastEnd.getTime() - reqStart.getTime() <= FLEX_WINDOW * 60000) {
        // Auto-adjust to right after the conflict
        const adjustedStart = lastEnd;
        const adjustedEnd = new Date(adjustedStart.getTime() + duration * 60000);

        const booking = await Booking.create({
          businessId,
          userId,
          startTime: adjustedStart,
          endTime: adjustedEnd,
          duration,
          serviceType: serviceType || "general",
          notes,
        });

        console.log(`📅 Booking auto-adjusted: ${adjustedStart.toLocaleTimeString()} (shifted from ${reqStart.toLocaleTimeString()})`);

        return {
          booking: await booking.populate("userId", "name email avatar"),
          adjusted: true,
          originalTime: reqStart,
        };
      }
    }

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

  const booking = await Booking.create({
    businessId,
    userId,
    startTime: reqStart,
    endTime: reqEnd,
    duration,
    serviceType: serviceType || "general",
    notes,
  });

  console.log(`📅 Booking created: ${reqStart.toLocaleTimeString()} - ${reqEnd.toLocaleTimeString()}`);

  return {
    booking: await booking.populate("userId", "name email avatar"),
    adjusted: false,
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

  // ⚠️ Capture original endTime BEFORE mutation for correct future-booking query
  const originalEndTime = new Date(booking.endTime);

  // Update current booking
  booking.endTime = new Date(booking.endTime.getTime() + extraMs);
  booking.extendedTime += mins;
  booking.extraCharge += extraCharge;
  booking.duration += mins;
  await booking.save();

  console.log(`⏱️ Booking extended: +${mins}min, charge: ₹${extraCharge}`);

  // Shift all future bookings — use ORIGINAL endTime to find them
  const futureBookings = await Booking.find({
    businessId: booking.businessId,
    startTime: { $gte: originalEndTime },
    status: { $nin: ["cancelled", "completed"] },
  }).sort({ startTime: 1 }).populate("userId", "name email");

  const affectedUsers = [];

  for (const fb of futureBookings) {
    fb.startTime = new Date(fb.startTime.getTime() + extraMs);
    fb.endTime = new Date(fb.endTime.getTime() + extraMs);
    fb.delayMinutes += extraMinutes;

    // If delay exceeds threshold, mark as pending confirmation
    if (fb.delayMinutes >= MAX_DELAY_THRESHOLD) {
      fb.delayAccepted = null; // needs user action
    }

    await fb.save();

    affectedUsers.push({
      userId: fb.userId._id,
      name: fb.userId.name,
      newStartTime: fb.startTime,
      newEndTime: fb.endTime,
      totalDelay: fb.delayMinutes,
      needsConfirmation: fb.delayMinutes >= MAX_DELAY_THRESHOLD,
    });
  }

  console.log(`📊 ${affectedUsers.length} bookings shifted by ${mins} min`);

  // Emit Socket.IO notifications to affected users
  if (io && affectedUsers.length > 0) {
    for (const affected of affectedUsers) {
      io.emit("booking:delayed", {
        userId: affected.userId,
        message: `Your service is delayed by ${affected.totalDelay} minutes due to an extended service ahead of you`,
        newStartTime: affected.newStartTime,
        newEndTime: affected.newEndTime,
        totalDelay: affected.totalDelay,
        needsConfirmation: affected.needsConfirmation,
      });
    }
    // Also broadcast timeline update to the business room
    io.to(`business:${booking.businessId}`).emit("bookings:updated");
  }

  return {
    booking,
    extraCharge,
    totalExtraCharge: booking.extraCharge,
    affectedUsers,
    ratePerMinute: RATE_PER_MINUTE,
  };
};

// ─── Accept / Cancel Delay ────────────────────────────────────
export const respondToDelay = async (bookingId, userId, accept) => {
  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) throw new ApiError(404, "Booking not found");

  if (accept) {
    booking.delayAccepted = true;
    await booking.save();
    console.log(`✅ Delay accepted for booking ${bookingId}`);
    return { booking, action: "accepted" };
  } else {
    booking.status = "cancelled";
    booking.delayAccepted = false;
    await booking.save();
    console.log(`❌ Booking ${bookingId} cancelled due to delay`);
    return { booking, action: "cancelled" };
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
