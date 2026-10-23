import mongoose from "mongoose";
import Booking from "./booking.model.js";
import Business from "../modules/business/business.model.js";
import User from "../modules/auth/auth.model.js";
import Queue from "../queue/queue.model.js";
import Review from "../modules/review/review.model.js";
import ApiError from "../../utils/ApiError.js";
import { getRazorpayClient } from "../modules/payment/razorpay.service.js";
import { validateCoupon } from "../modules/coupon/coupon.service.js";
import { isBusinessSubscriptionActive } from "../modules/subscription/subscription.service.js";

const RATE_PER_MINUTE = 20; // ₹20 per extra minute
const FLEX_WINDOW = 10; // ±10 minutes flexibility

// ─── Available Slots ──────────────────────────────────────────
export const getAvailableSlots = async (businessId, date) => {
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  const isSubscribed = await isBusinessSubscriptionActive(business);
  if (!isSubscribed) {
    throw new ApiError(
      403,
      "This venue is currently not accepting appointments because its ServeQ subscription is inactive."
    );
  }

  const avgTime = business.averageServiceTime || 10;
  const staffList = Array.isArray(business.staff) ? business.staff.filter((s) => s.isAvailable !== false) : [];
  const maxCapacity = Math.max(staffList.length || 1, business.maxCapacity || 1);

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

    const overlappingBookings = bookings.filter((b) => {
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      const sStart = slotStart.getTime();
      const sEnd = slotEnd.getTime();
      return sStart < bEnd && sEnd > bStart;
    });

    const isAvailable = overlappingBookings.length < maxCapacity;

    slots.push({
      startTime: slotStart.toISOString(),
      endTime: slotEnd.toISOString(),
      duration: avgTime,
      available: isAvailable,
      capacityRemaining: Math.max(0, maxCapacity - overlappingBookings.length),
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
    maxCapacity,
  };
};

// ─── Create Booking ───────────────────────────────────────────
export const createBooking = async ({
  businessId,
  userId,
  startTime,
  serviceType,
  services,
  preferredStaff,
  notes,
  isGroupBooking,
  guestCount,
  pricingLabel,
  couponCode,
  paymentMethod = "WALLET",
}, io = null) => {
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  // Validate that business has an active ServeQ subscription
  const isSubscribed = await isBusinessSubscriptionActive(business);
  if (!isSubscribed) {
    throw new ApiError(
      403,
      "This venue is currently not accepting appointments because its ServeQ subscription is inactive."
    );
  }

  // Validate business booking preferences
  if (business.bookingSettings?.enableAppointments === false) {
    throw new ApiError(403, "Appointment booking is currently disabled for this business");
  }

  const now = new Date();
  const maxAdvanceDays = business.bookingSettings?.maxAdvanceBookingDays || 14;
  const maxAdvanceDate = new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);
  if (new Date(startTime) > maxAdvanceDate) {
    throw new ApiError(400, `Appointments cannot be booked more than ${maxAdvanceDays} days in advance`);
  }

  if (business.bookingSettings?.allowSameDayBooking === false) {
    const isSameDay = new Date(startTime).toDateString() === now.toDateString();
    if (isSameDay) {
      throw new ApiError(400, "Same-day booking is not permitted by this business");
    }
  }

  // 1. Process multiple services or fallback to single service
  let selectedServicesList = [];
  let duration = 0;
  let totalCost = 0;

  if (Array.isArray(services) && services.length > 0) {
    selectedServicesList = services.map((s) => ({
      name: s.name,
      duration: Math.max(1, Number(s.duration) || 15),
      price: Math.max(0, Number(s.price) || 0),
    }));
    duration = selectedServicesList.reduce((sum, s) => sum + s.duration, 0);
    totalCost = selectedServicesList.reduce((sum, s) => sum + s.price, 0);
  } else if (serviceType) {
    const matched = business.services?.find((s) => s.name === serviceType);
    const sDur = matched?.duration || business.averageServiceTime || 15;
    let sPrice = business.basePrice || 0;
    if (pricingLabel) {
      const specificPricing = business.pricing?.find((p) => p.label === pricingLabel);
      if (specificPricing) sPrice = specificPricing.price;
    }
    if (matched && matched.price !== undefined) {
      sPrice = matched.price;
    }
    selectedServicesList = [{ name: serviceType, duration: sDur, price: sPrice }];
    duration = sDur;
    totalCost = sPrice;
  } else {
    duration = business.averageServiceTime || 15;
    totalCost = business.basePrice || 0;
    selectedServicesList = [{ name: "General Service", duration, price: totalCost }];
  }

  const reqStart = new Date(startTime);
  const reqEnd = new Date(reqStart.getTime() + duration * 60000);

  // 2. Check duplicate booking for this user
  const duplicate = await Booking.findOne({
    businessId,
    userId,
    startTime: reqStart,
    status: { $nin: ["cancelled", "refunded"] },
  });
  if (duplicate) throw new ApiError(409, "You already have an active booking at this time.");

  // 3. Staff Assignment (Doctor / Barber) with auto-fallback
  const isClinic = business.category === "clinic" || business.category === "healthcare";
  const staffList = Array.isArray(business.staff) ? business.staff : [];
  const staffNameRequested = typeof preferredStaff === "string" ? preferredStaff.trim() : preferredStaff?.name?.trim();

  let assignedStaff = null;

  // Check if requested specific doctor/barber is available
  if (staffNameRequested && staffNameRequested.toLowerCase() !== "any") {
    const candidate = staffList.find(
      (s) => s.name.toLowerCase() === staffNameRequested.toLowerCase() && s.isAvailable !== false
    );
    if (candidate) {
      const conflict = await Booking.findOne({
        businessId,
        status: { $nin: ["cancelled", "refunded"] },
        "assignedStaff.name": candidate.name,
        startTime: { $lt: reqEnd },
        endTime: { $gt: reqStart },
      });
      if (!conflict) {
        assignedStaff = {
          name: candidate.name,
          role: candidate.role || (isClinic ? "Doctor / Specialist" : "Barber / Stylist"),
          specialties: candidate.specialties || "",
          autoAssigned: false,
        };
      }
    }
  }

  // Fallback if not assigned:
  // If clinic: assign to an available General Physician (or on-duty physician)
  // If salon: assign to any available barber at that time (or on-duty stylist)
  if (!assignedStaff) {
    if (isClinic) {
      const activeDocs = staffList.filter((s) => s.isAvailable !== false);
      const freeDocs = [];

      for (const doc of activeDocs) {
        const busy = await Booking.findOne({
          businessId,
          status: { $nin: ["cancelled", "refunded"] },
          "assignedStaff.name": doc.name,
          startTime: { $lt: reqEnd },
          endTime: { $gt: reqStart },
        });
        if (!busy) {
          const text = `${doc.role || ""} ${doc.specialties || ""} ${doc.name || ""}`.toLowerCase();
          const isGP =
            text.includes("general") ||
            text.includes("physician") ||
            text.includes("primary") ||
            text.includes("family") ||
            text.includes("mbbs") ||
            text.includes("medicine");
          freeDocs.push({ doc, isGP });
        }
      }

      const chosen = freeDocs.find((d) => d.isGP)?.doc || freeDocs[0]?.doc;
      if (chosen) {
        assignedStaff = {
          name: chosen.name,
          role: chosen.role || "General Physician",
          specialties: chosen.specialties || "General Medicine & Primary Care",
          autoAssigned: true,
        };
      } else {
        assignedStaff = {
          name: "Dr. On-Duty (General Physician)",
          role: "General Physician",
          specialties: "General Medicine & Primary Care",
          autoAssigned: true,
        };
      }
    } else {
      // Salon: assign any barber available at that time
      let chosenBarber = null;
      const activeBarbers = staffList.filter((s) => s.isAvailable !== false);

      for (const barber of activeBarbers) {
        const busy = await Booking.findOne({
          businessId,
          status: { $nin: ["cancelled", "refunded"] },
          "assignedStaff.name": barber.name,
          startTime: { $lt: reqEnd },
          endTime: { $gt: reqStart },
        });
        if (!busy) {
          chosenBarber = barber;
          break;
        }
      }

      if (chosenBarber) {
        assignedStaff = {
          name: chosenBarber.name,
          role: chosenBarber.role || "Barber / Stylist",
          specialties: chosenBarber.specialties || "Hair Styling & Grooming",
          autoAssigned: true,
        };
      } else {
        assignedStaff = {
          name: "On-Duty Stylist",
          role: "Barber / Stylist",
          specialties: "Hair Styling & Grooming",
          autoAssigned: true,
        };
      }
    }
  }

  // 4. Overall capacity check
  const activeStaffCount = staffList.filter((s) => s.isAvailable !== false).length;
  const maxCapacity = Math.max(activeStaffCount || 1, business.maxCapacity || 1);
  const overlappingCount = await Booking.countDocuments({
    businessId,
    status: { $nin: ["cancelled", "refunded"] },
    startTime: { $lt: reqEnd },
    endTime: { $gt: reqStart },
  });

  if (overlappingCount >= maxCapacity) {
    throw new ApiError(409, "All practitioners are fully booked for this time slot. Please select another slot.");
  }

  // 5. Apply Coupon if provided
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

  // 6. Payment Processing: Pay at Counter only (All customer bookings are settled at counter)
  const selectedPaymentMethod = "counter";
  const paymentStatus = "pending";
  const bookingStatus = "confirmed";
  const paidAmount = finalAmount;

  const combinedServiceNames = selectedServicesList.map((s) => s.name).join(" + ");

  const booking = await Booking.create({
    businessId,
    userId,
    startTime: reqStart,
    endTime: reqEnd,
    duration,
    serviceType: combinedServiceNames,
    services: selectedServicesList,
    assignedStaff,
    isGroupBooking: !!isGroupBooking,
    guestCount: guestCount || 1,
    notes,
    pricingLabel: pricingLabel || combinedServiceNames,
    amount: finalAmount,
    paidAmount,
    paymentMethod: selectedPaymentMethod,
    paymentStatus,
    status: bookingStatus,
  });

  if (io && bookingStatus === "confirmed") {
    io.to(`business:${businessId}`).emit("bookings:updated");
    io.to(`user:${userId}`).emit("booking:confirmed", { booking });
  }

  return {
    booking: await booking.populate("userId", "name email avatar"),
    assignedStaff,
    adjusted: false,
    finalAmount,
    paymentMethod: selectedPaymentMethod,
    paymentStatus,
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

  // Synchronize with live Queue if present
  try {
    const QueueModel = mongoose.models.Queue || mongoose.model("Queue");
    if (QueueModel) {
      const queueDoc = await QueueModel.findOne({ businessId: booking.businessId });
      if (queueDoc && Array.isArray(queueDoc.users)) {
        const u = queueDoc.users.find(
          (user) => (user.bookingId && user.bookingId.toString() === booking._id.toString()) ||
                    (user.userId && user.userId.toString() === booking.userId.toString() && user.status !== "done")
        );
        if (u) {
          u.status = "serving";
          await queueDoc.save();
        }
      }
    }
  } catch {
    // Non-critical queue sync
  }

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

  // Ensure paidAmount is populated if was 0 or unrecorded
  if (!booking.paidAmount || booking.paidAmount === 0) {
    const svcPrice = (booking.services || []).reduce(
      (sum, s) => sum + (Number(s.price) || 0),
      0
    ) || business.basePrice || 0;
    if (svcPrice > 0) {
      booking.paidAmount = svcPrice;
    }
  }

  await booking.save();

  // Increment doctor/staff customersServed count
  if (booking.assignedStaff?.name && Array.isArray(business.staff)) {
    const staffMember = business.staff.find(
      (s) => s.name?.toLowerCase() === booking.assignedStaff.name.toLowerCase()
    );
    if (staffMember) {
      staffMember.customersServed = (staffMember.customersServed || 0) + 1;
      await business.save();
    }
  }

  // Synchronize and remove finished patron from live Queue if present
  try {
    const QueueModel = mongoose.models.Queue || mongoose.model("Queue");
    const QueueDS = (await import("../queue/queue.ds.js")).default;
    if (QueueModel && QueueDS) {
      const queueDoc = await QueueModel.findOne({ businessId: booking.businessId });
      if (queueDoc && Array.isArray(queueDoc.users)) {
        const matchingUser = queueDoc.users.find(
          (user) => (user.bookingId && user.bookingId.toString() === booking._id.toString()) ||
                    (user.userId && user.userId.toString() === booking.userId.toString() && user.status !== "done")
        );
        if (matchingUser) {
          const queueDS = QueueDS.fromArray(queueDoc.users);
          queueDS.remove(matchingUser.userId);
          queueDoc.users = queueDS.toArray();
          await queueDoc.save();
        }
      }
    }
  } catch {
    // Non-critical queue sync
  }

  return booking;
};

// ─── Queries & Cancel ─────────────────────────────────────────
export const getMyBookings = async (userId) => {
  let bookings = await Booking.find({ userId })
    .populate("businessId", "name category address location phone averageServiceTime")
    .sort({ startTime: -1, createdAt: -1 });

  // Convert mongoose documents to plain objects for mutation
  bookings = bookings.map((b) => (typeof b.toObject === "function" ? b.toObject() : { ...b }));

  // Check active queues where user is currently waiting or serving
  try {
    const activeQueues = await Queue.find({ "users.userId": userId }).populate(
      "businessId",
      "name category address location phone averageServiceTime"
    );

    for (const qDoc of activeQueues) {
      const idx = (qDoc.users || []).findIndex(
        (u) => (u.userId?._id || u.userId)?.toString() === userId.toString()
      );
      if (idx !== -1) {
        const qUser = qDoc.users[idx];
        const position = idx + 1;
        const isServing = qUser.status === "serving" || idx === 0;
        const peopleAhead = Math.max(0, idx);

        const existingBooking = bookings.find(
          (b) =>
            (qUser.bookingId && b._id?.toString() === qUser.bookingId?.toString()) ||
            (b.businessId?._id?.toString() === qDoc.businessId?._id?.toString() &&
              ["waiting", "serving"].includes(b.status))
        );

        if (existingBooking) {
          existingBooking.entryType = "live_queue";
          existingBooking.isLiveQueue = true;
          existingBooking.queuePosition = position;
          existingBooking.tokenNumber = position;
          existingBooking.totalInQueue = qDoc.users.length;
          existingBooking.peopleAhead = peopleAhead;
          existingBooking.isServing = isServing;
          existingBooking.status = isServing ? "serving" : "waiting";
        } else {
          // Prepend active live queue entry
          const qBooking = {
            _id: qUser.bookingId || `live_q_${qDoc._id}_${userId}`,
            businessId: qDoc.businessId,
            userId,
            startTime: qUser.joinedAt || new Date(),
            endTime: new Date(Date.now() + (qUser.serviceTime || 15) * 60000),
            duration: qUser.serviceTime || 15,
            serviceType: qUser.serviceType || "General Service",
            services: qUser.services || [],
            assignedStaff: qUser.assignedStaff || { name: "", role: "" },
            status: isServing ? "serving" : "waiting",
            paidAmount: qUser.paidAmount || 0,
            entryType: "live_queue",
            isLiveQueue: true,
            queuePosition: position,
            tokenNumber: position,
            totalInQueue: qDoc.users.length,
            peopleAhead,
            isServing,
            notes: "Direct Live Queue Entry",
            createdAt: qUser.joinedAt || new Date(),
          };
          bookings.unshift(qBooking);
        }
      }
    }
  } catch (qErr) {
    console.error("Error attaching active live queues to getMyBookings:", qErr);
  }

  // Tag entryType for all bookings
  bookings.forEach((b) => {
    if (!b.entryType) {
      if (b.notes?.includes("Live Queue") || ["waiting", "serving"].includes(b.status)) {
        b.entryType = "live_queue";
        b.isLiveQueue = true;
      } else {
        b.entryType = "appointment";
        b.isAppointment = true;
      }
    }
  });

  // Attach reviews if present
  try {
    if (bookings.length > 0) {
      const bookingIds = bookings.map((b) => b._id).filter((id) => mongoose.Types.ObjectId.isValid(id));
      const reviews = await Review.find({ bookingId: { $in: bookingIds } });
      const reviewMap = new Map();
      reviews.forEach((r) => reviewMap.set(r.bookingId?.toString(), r));

      return bookings.map((b) => {
        const rev = reviewMap.get(b._id?.toString());
        if (rev) {
          b.review = {
            _id: rev._id,
            rating: rev.rating,
            comment: rev.comment,
            createdAt: rev.createdAt,
          };
        }
        return b;
      });
    }
  } catch (err) {
    console.error("Error attaching reviews to bookings:", err);
  }

  return bookings;
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

  const refundAmount = booking.paidAmount || 0;
  let refundId = null;

  if (refundAmount > 0 && booking.paymentMethod === "online" && booking.razorpayPaymentId) {
    try {
      const rzp = getRazorpayClient();
      if (rzp) {
        const refundResponse = await rzp.payments.refund(booking.razorpayPaymentId, {
          amount: Math.round(refundAmount * 100),
          notes: {
            reason: "Customer cancellation",
            bookingId: booking._id.toString(),
          },
        });
        refundId = refundResponse?.id;
      } else {
        refundId = `ref_mock_${Date.now()}`;
      }
      booking.status = "refunded";
      booking.paymentStatus = "refunded";
      booking.refundReference = refundId;
      booking.refundedAt = new Date();
    } catch (err) {
      console.error("Razorpay refund error on cancellation:", err);
      booking.status = "cancelled";
      booking.paymentFailureReason = `Refund pending: ${err.message}`;
    }
  } else {
    booking.status = "cancelled";
    if (booking.paymentStatus === "pending") {
      booking.paymentStatus = "failed";
      booking.paymentFailureReason = "Booking cancelled prior to payment";
    }
  }

  await booking.save();

  if (io) {
    io.to(`business:${booking.businessId}`).emit("bookings:updated");
  }

  return { booking, refunded: refundAmount, refundId };
};

/**
 * Record payment collection at counter by authorized business staff
 */
export const collectCounterPayment = async (bookingId, staffUser, io = null) => {
  const booking = await Booking.findById(bookingId).populate("businessId");
  if (!booking) throw new ApiError(404, "Booking not found");

  const business = booking.businessId;
  if (
    staffUser.role !== "admin" &&
    business?.owner?.toString() !== staffUser._id?.toString()
  ) {
    throw new ApiError(403, "Not authorized to collect payment for this business");
  }

  if (booking.paymentStatus === "paid") {
    throw new ApiError(400, "Payment for this booking is already recorded as paid");
  }

  booking.paymentStatus = "paid";
  booking.collectedByStaff = true;
  booking.collectedAt = new Date();
  booking.paidAmount = booking.amount || booking.paidAmount || 0;
  if (booking.status === "pending_payment") {
    booking.status = "confirmed";
  }
  await booking.save();

  // Also sync live queue patron if currently in queue
  try {
    const queueDoc = await Queue.findOne({ businessId: business._id || business });
    if (queueDoc && Array.isArray(queueDoc.users)) {
      let queueUpdated = false;
      queueDoc.users.forEach((u) => {
        if (
          (u.bookingId && u.bookingId.toString() === booking._id.toString()) ||
          (u.userId && u.userId.toString() === booking.userId.toString())
        ) {
          u.paymentStatus = "paid";
          u.paymentMethod = "counter";
          queueUpdated = true;
        }
      });
      if (queueUpdated) {
        await queueDoc.save();
        if (io) {
          io.to(`business:${business._id || business}`).emit("queue:updated", {
            businessId: business._id || business,
            queue: queueDoc,
          });
          io.to(`business:${business._id || business}`).emit("queue:update", queueDoc);
        }
      }
    }
  } catch (qErr) {
    console.warn("Could not sync queue payment status:", qErr.message);
  }

  if (io) {
    io.to(`business:${business._id || business}`).emit("bookings:updated");
    io.to(`user:${booking.userId}`).emit("booking:payment_collected", {
      bookingId: booking._id,
      amount: booking.paidAmount,
    });
  }

  return booking;
};

