import { publishQueue } from "../queue/queue.view.js";
import { cancelWalkIn } from '../queue/walk-in.service.js';
import { notifyUser, turnNotificationPayload } from '../modules/notification/notification.service.js';
import { assertTestVenueAccess } from '../modules/admin/admin-workspace.service.js';
import { isClinic, isAssignedToDoctor, requireAssigned } from "../modules/doctor/doctor-access.js";
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
import { isWithinClinicCapacity } from '../modules/subscription/clinic-capacity.service.js';
import { getBookingDateError, getBusinessDate } from "../utils/bookingDates.js";
import { scheduleVisitNotice } from '../modules/whatsapp/visit-notice-outbox.js';
import { nextServiceStep } from '../modules/doctor/service-sequencing.js';

const RATE_PER_MINUTE = 20; // ₹20 per extra minute
const FLEX_WINDOW = 10; // ±10 minutes flexibility

// ─── Available Slots ──────────────────────────────────────────
export const getAvailableSlots = async (businessId, date) => {
  const business = await Business.findById(businessId);
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");
  if (business.isActive === false || ["pending", "suspended"].includes(business.approvalStatus)) {
    throw new ApiError(403, "This clinic is not accepting appointments.");
  }

  const dateError = getBookingDateError(date, business);
  if (dateError) {
    throw new ApiError(business.bookingSettings?.enableAppointments === false ? 403 : 400, dateError);
  }

  const isSubscribed = await isBusinessSubscriptionActive(business);
  if (!isSubscribed) {
    throw new ApiError(
      403,
      "This venue is currently not accepting appointments because its ServeQ subscription is inactive."
    );
  }
  if (!await isWithinClinicCapacity(business)) throw new ApiError(403, 'This clinic has reached its subscription capacity and cannot accept new appointments.');

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
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");
  assertTestVenueAccess(business, userId);

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
  const requestedStart = new Date(startTime);
  const dateError = getBookingDateError(getBusinessDate(requestedStart, business), business, now);
  if (dateError) throw new ApiError(400, dateError);
  if (requestedStart <= now) throw new ApiError(400, "Appointments cannot be booked in the past");

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

  // Apply an optional coupon before opening the booking transaction
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

  // Customer bookings are settled at the counter.
  const selectedPaymentMethod = "counter";
  const paymentStatus = "pending";
  const bookingStatus = "confirmed";
  const paidAmount = finalAmount;

  const combinedServiceNames = selectedServicesList.map((s) => s.name).join(" + ");

  const booking = await mongoose.connection.transaction(async (session) => {
    // Serialize reservations for this clinic. A conflicting transaction retries
    // with a fresh snapshot before it can check capacity or insert a booking.
    const lock = await Business.updateOne(
      { _id: businessId, isActive: { $ne: false }, approvalStatus: { $nin: ["pending", "suspended"] } },
      { $inc: { bookingRevision: 1 } },
      { session, timestamps: false },
    );
    if (!lock.matchedCount) throw new ApiError(403, "This clinic is not accepting appointments.");
    if (!await isWithinClinicCapacity(business, session)) throw new ApiError(403, 'This clinic has reached its subscription capacity and cannot accept new appointments.');

    // Check duplicate booking for this user
    const duplicate = await Booking.findOne({
      businessId,
      userId,
      startTime: reqStart,
      status: { $nin: ["cancelled", "refunded"] },
    }, null, { session });
    if (duplicate) throw new ApiError(409, "You already have an active booking at this time.");

    // Assign an available doctor
    const roster = Array.isArray(business.staff) ? business.staff : [];
    const registeredDoctors = roster.filter(staff => staff.email && staff.doctorId);
    const staffList = registeredDoctors.length ? registeredDoctors : roster;
    const staffNameRequested = typeof preferredStaff === "string" ? preferredStaff.trim() : preferredStaff?.name?.trim();

    let assignedStaff = null;

    // Check if requested specific doctor is available
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
        }, null, { session });
        if (!conflict) {
          assignedStaff = {
            staffId: candidate._id,
            name: candidate.name,
            role: candidate.role || "Doctor / Specialist",
            specialties: candidate.specialties || "",
            autoAssigned: false,
          };
        }
      }
    }

    if (!assignedStaff) {
      const activeDocs = staffList.filter((s) => s.isAvailable !== false);
      const freeDocs = [];

      for (const doc of activeDocs) {
        const busy = await Booking.findOne({
          businessId,
          status: { $nin: ["cancelled", "refunded"] },
          "assignedStaff.name": doc.name,
          startTime: { $lt: reqEnd },
          endTime: { $gt: reqStart },
        }, null, { session });
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
          staffId: chosen._id,
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
    }

    // Check overall capacity
    const activeStaffCount = staffList.filter((s) => s.isAvailable !== false).length;
    const maxCapacity = Math.max(activeStaffCount || 1, business.maxCapacity || 1);
    const overlappingCount = await Booking.countDocuments({
      businessId,
      status: { $nin: ["cancelled", "refunded"] },
      startTime: { $lt: reqEnd },
      endTime: { $gt: reqStart },
    }, { session });

    if (overlappingCount >= maxCapacity) {
      throw new ApiError(409, "All practitioners are fully booked for this time slot. Please select another slot.");
    }

    const [booking] = await Booking.create([{
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
      whatsappVisitNotice: scheduleVisitNotice(new Date(reqStart.getTime() - 86_400_000), reqStart),
    }], { session });
    return booking;
  });

  booking.$session?.(null);
  if (io && bookingStatus === "confirmed") {
    io.to(`business:${businessId}`).emit("bookings:updated");
    io.to(`user:${userId}`).emit("booking:confirmed", { booking });
  }

  return {
    booking: await booking.populate("userId", "name email avatar"),
    assignedStaff: booking.assignedStaff,
    adjusted: false,
    finalAmount,
    paymentMethod: selectedPaymentMethod,
    paymentStatus,
  };
};

// ─── Extend Booking ───────────────────────────────────────────
export const extendBooking = async (bookingId, extraMinutes, requesterId, requesterRole, io, doctor = null) => {
  const booking = await Booking.findById(bookingId).populate("userId", "name email");
  if (!booking) throw new ApiError(404, "Booking not found");
  if (doctor) requireAssigned(booking, doctor);

  const business = await Business.findById(booking.businessId);
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");
  if (requesterRole !== "admin" && business.owner.toString() !== requesterId.toString()) {
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
  const delayNotifications = [];

  for (const fb of futureBookings) {
    if (doctor && !isAssignedToDoctor(fb, doctor)) continue;
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
    delayNotifications.push(notifyUser({
      recipient: fb.userId._id,
      type: 'booking',
      title: 'Appointment delayed',
      message: `Your appointment at ${business.name} was delayed by ${mins} minutes. We credited ₹${rewardAmount} to your wallet.`,
      href: `/booking/${booking.businessId}`,
      eventKey: `booking:delay:${fb._id}:${fb.startTime.getTime()}`,
    }, io));
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

  await Promise.all(delayNotifications);
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
export const startService = async (bookingId, requesterId, requesterRole, doctor = null, io = null) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found");
  if (doctor) requireAssigned(booking, doctor);
  if (booking.walkIn) throw new ApiError(409, 'Start this walk-in from the doctor’s live queue.');

  const business = await Business.findById(booking.businessId);
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");
  if (requesterRole !== "admin" && business.owner.toString() !== requesterId.toString()) {
    throw new ApiError(403, "Access denied: you can only start services for your own business");
  }

  if (!["scheduled", "confirmed", "waiting"].includes(booking.status)) {
    throw new ApiError(400, `Cannot start service from '${booking.status}' status`);
  }

  booking.status = "serving";
  booking.startTime = new Date();
  booking.endTime = new Date(booking.startTime.getTime() + Math.max(1, Number(booking.duration) || 15) * 60000);
  await booking.save();

  // Synchronize with live Queue if present
  try {
    const QueueModel = mongoose.models.Queue || mongoose.model("Queue");
    if (QueueModel) {
      const queueDoc = await QueueModel.findOne({ businessId: booking.businessId });
      if (queueDoc && Array.isArray(queueDoc.users)) {
        const u = queueDoc.users.find(
          user => {
            if (doctor && !isAssignedToDoctor(user, doctor)) return false;
            if (user.bookingId?.toString() === booking._id.toString()) return true;
            return !doctor && user.userId?.toString() === booking.userId.toString() && user.status !== "done";
          }
        );
        if (u) {
          u.status = "serving";
          u.estimatedStartTime = booking.startTime;
          u.serviceTime = booking.duration;
          await queueDoc.save();
        }
      }
    }
  } catch {
    // Non-critical queue sync
  }

  await notifyUser(turnNotificationPayload(business, {
    userId: booking.userId, bookingId: booking._id, assignedStaff: booking.assignedStaff,
  }), io);

  return booking;
};

export async function advanceAppointmentService(booking, expectedStep, doctor) {
  const serviceStep = await nextServiceStep(booking, expectedStep, doctor);
  if (booking.walkIn || await Queue.exists({ businessId: booking.businessId, 'users.bookingId': booking._id })) {
    throw new ApiError(409, 'Continue this visit from the live queue.');
  }
  const assignment = booking.assignedStaff.staffId ? { 'assignedStaff.staffId': booking.assignedStaff.staffId }
    : { 'assignedStaff.staffId': null, 'assignedStaff.name': booking.assignedStaff.name };
  const result = await Booking.updateOne({
    _id: booking._id, businessId: booking.businessId, status: booking.status, ...assignment,
    serviceStep: expectedStep || { $in: [0, null] },
  }, { $set: { serviceStep } });
  if (!result.modifiedCount) throw new ApiError(409, 'The appointment changed. Refresh before moving to the next service.');
}

// ─── Complete Service ─────────────────────────────────────────
export const completeService = async (bookingId, requesterId, requesterRole, doctor = null) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found");
  if (doctor) requireAssigned(booking, doctor);

  const business = await Business.findById(booking.businessId);
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");
  if (requesterRole !== "admin" && business.owner.toString() !== requesterId.toString()) {
    throw new ApiError(403, "Access denied: you can only complete services for your own business");
  }

  if (!["serving", "in-progress"].includes(booking.status)) {
    throw new ApiError(400, `Cannot complete service from '${booking.status}' status`);
  }

  const claimed = await Booking.findOneAndUpdate({
    _id: bookingId, status: { $in: ["serving", "in-progress"] },
  }, { $set: { status: "completed" } }, { new: true });
  if (!claimed) throw new ApiError(409, "This service has already been completed or changed");
  return finalizeCompletedBooking(claimed, business);
};

// Atomic claim prevents overlapping background runs from completing/counting the same booking twice.
export const completeExpiredBooking = async (bookingId, now = new Date()) => {
  const booking = await Booking.findOneAndUpdate({
    _id: bookingId,
    status: { $in: ["confirmed", "scheduled", "delayed", "serving", "in-progress", "waiting"] },
    endTime: { $lte: now },
  }, { $set: { status: "completed" } }, { new: true });
  if (!booking) return null;
  const business = await Business.findById(booking.businessId);
  if (!business) return booking;
  return finalizeCompletedBooking(booking, business);
};

const finalizeCompletedBooking = async (booking, business) => {
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
  bookings = bookings.filter(booking => isClinic(booking.businessId))
    .map(booking => booking.toObject?.() || { ...booking });

  // Check active queues where user is currently waiting or serving
  try {
    const activeQueues = await Queue.find({ "users.userId": userId }).populate(
      "businessId",
      "name category address location phone averageServiceTime"
    );

    for (const qDoc of activeQueues) {
      if (!isClinic(qDoc.businessId)) continue;
      const idx = (qDoc.users || []).findIndex(
        (u) => (u.userId?._id || u.userId)?.toString() === userId.toString()
      );
      if (idx !== -1) {
        const qUser = qDoc.users[idx];
        const linkedBooking = qUser.bookingId && bookings.find(
          (booking) => booking._id?.toString() === qUser.bookingId.toString()
        );
        // Completion can be read before its queue cleanup finishes. Never resurrect a terminal booking.
        if (linkedBooking && ["completed", "cancelled", "refunded"].includes(linkedBooking.status)) continue;
        const position = idx + 1;
        const isServing = qUser.status === "serving" || (!qUser.status && idx === 0);
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
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");

  if (requesterRole !== "admin" && business.owner.toString() !== requesterId.toString()) {
    throw new ApiError(403, "Access denied: not the owner of this business");
  }
  if (requesterRole === 'owner') throw new ApiError(403, 'Patient visits are available on the doctor dashboard.');

  return await Booking.find({ businessId })
    .populate("userId", "name email avatar phone")
    .sort({ startTime: 1 });
};

export const cancelBooking = async (bookingId, userId, io = null) => {
  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.walkIn) return { booking: (await cancelWalkIn(bookingId, userId, io)).booking, refunded: 0, refundId: null };
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
export const collectCounterPayment = async (bookingId, staffUser, io = null, doctor = null) => {
  const booking = await Booking.findById(bookingId).populate("businessId");
  if (!booking) throw new ApiError(404, "Booking not found");
  if (doctor) requireAssigned(booking, doctor);

  const business = booking.businessId;
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");
  if (
    staffUser.role !== "admin" &&
    business?.owner?.toString() !== staffUser._id?.toString()
  ) {
    throw new ApiError(403, "Not authorized to collect payment for this business");
  }

  if (doctor && (booking.paymentStatus !== "pending" || !["counter", "PAY_AT_BUSINESS"].includes(booking.paymentMethod))) throw new ApiError(409, "This payment cannot be recorded at the counter.");
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
        if (doctor && !isAssignedToDoctor(u, doctor)) return;
        if (
          u.bookingId?.toString() === booking._id.toString() ||
          (!doctor && u.userId?.toString() === booking.userId.toString())
        ) {
          u.paymentStatus = "paid";
          u.paymentMethod = "counter";
          queueUpdated = true;
        }
      });
      if (queueUpdated) {
        await queueDoc.save();
        publishQueue(io, business._id || business, queueDoc);
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

