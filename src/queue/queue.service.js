import mongoose from "mongoose";
import Queue from "./queue.model.js";
import QueueDS from "./queue.ds.js";
import { predictServiceTime } from "../../ai/gemini.service.js";
import Business from "../modules/business/business.model.js";
import ApiError from "../../utils/ApiError.js";
import { deductWalletBalance, refundToWallet } from "../modules/payment/payment.service.js";
import { validateCoupon } from "../modules/coupon/coupon.service.js";

// ➕ JOIN QUEUE
export const joinQueue = async (businessId, userData, io = null) => {
  let queueDoc = await Queue.findOne({ businessId });
  if (!queueDoc) {
    queueDoc = new Queue({ businessId, users: [] });
  }

  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");
  if (!business.isOpen || !business.isActive) {
    throw new ApiError(400, "This business is currently closed or not accepting queue entries");
  }

  // Validate business queue preferences
  if (business.queueSettings?.enableLiveQueue === false) {
    throw new ApiError(403, "Live queue is currently disabled for this business");
  }

  const maxCap = business.queueSettings?.maxQueueCapacity || 50;
  if (queueDoc.users.length >= maxCap) {
    throw new ApiError(400, `Live queue has reached maximum capacity of ${maxCap} patrons.`);
  }

  const queueDS = QueueDS.fromArray(queueDoc.users);

  // 🚫 Prevent duplicate joins
  if (queueDoc.users.some((u) => (u.userId?._id || u.userId)?.toString() === userData.userId?.toString())) {
    throw new ApiError(400, "You are already in this queue");
  }

  // 1. Process multiple services or fallback to single service
  let selectedServicesList = [];
  let baseServiceTime = 0;
  let price = 0;
  let finalServiceType = userData.serviceType || "general";

  if (Array.isArray(userData.services) && userData.services.length > 0) {
    selectedServicesList = userData.services.map((s) => ({
      name: s.name,
      duration: Math.max(1, Number(s.duration) || 15),
      price: Math.max(0, Number(s.price) || 0),
    }));
    baseServiceTime = selectedServicesList.reduce((sum, s) => sum + s.duration, 0);
    price = selectedServicesList.reduce((sum, s) => sum + s.price, 0);
    finalServiceType = selectedServicesList.map((s) => s.name).join(", ");
  } else if (userData.serviceType) {
    const matched = business.services?.find((s) => s.name === userData.serviceType);
    const sDur = matched?.duration || business.averageServiceTime || 15;
    let sPrice = business.basePrice || 0;
    if (userData.pricingLabel) {
      const specificPricing = business.pricing?.find((p) => p.label === userData.pricingLabel);
      if (specificPricing) sPrice = specificPricing.price;
    }
    if (matched && matched.price !== undefined) {
      sPrice = matched.price;
    }
    selectedServicesList = [{ name: userData.serviceType, duration: sDur, price: sPrice }];
    baseServiceTime = sDur;
    price = sPrice;
    finalServiceType = userData.serviceType;
  } else {
    baseServiceTime = business.averageServiceTime || 15;
    price = business.basePrice || 0;
    selectedServicesList = [{ name: "General Service", duration: baseServiceTime, price }];
    finalServiceType = "General Service";
  }

  // 2. Staff Assignment (Doctor / Barber) with auto-fallback
  const isClinic = business.category === "clinic" || business.category === "healthcare";
  const staffList = Array.isArray(business.staff) ? business.staff : [];
  const staffNameRequested = typeof userData.preferredStaff === "string"
    ? userData.preferredStaff.trim()
    : userData.preferredStaff?.name?.trim();

  // Find staff members currently serving in queue OR active appointments
  const currentlyServingStaff = queueDoc.users
    .filter((u) => u.status === "serving" && u.assignedStaff?.name)
    .map((u) => u.assignedStaff.name.toLowerCase());

  try {
    const Booking = mongoose.models.Booking || mongoose.model("Booking");
    if (Booking && (mongoose.connection?.readyState === 1 || Booking.find !== mongoose.Model.find)) {
      const now = new Date();
      const activeBookings = await Booking.find({
        businessId,
        status: { $in: ["confirmed", "serving"] },
        startTime: { $lte: now },
        endTime: { $gte: now },
      }).select("assignedStaff");
      activeBookings?.forEach((bk) => {
        if (bk.assignedStaff?.name) currentlyServingStaff.push(bk.assignedStaff.name.toLowerCase());
      });
    }
  } catch {
    // Non-critical fallback
  }

  let assignedStaff = null;

  // Check requested doctor / barber
  if (staffNameRequested && staffNameRequested.toLowerCase() !== "any") {
    const candidate = staffList.find(
      (s) => s.name.toLowerCase() === staffNameRequested.toLowerCase() && s.isAvailable !== false
    );
    if (candidate && !currentlyServingStaff.includes(candidate.name.toLowerCase())) {
      assignedStaff = {
        name: candidate.name,
        role: candidate.role || (isClinic ? "Doctor / Specialist" : "Barber / Stylist"),
        specialties: candidate.specialties || "",
        autoAssigned: false,
      };
    }
  }

  // Auto-fallback if requested staff unavailable or not specified
  if (!assignedStaff) {
    if (isClinic) {
      // Find on-duty available General Physician
      const activeDocs = staffList.filter(
        (s) => s.isAvailable !== false && !currentlyServingStaff.includes(s.name.toLowerCase())
      );
      const freeDocs = [];
      for (const doc of activeDocs) {
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
      // Salon: assign any available barber
      const activeBarbers = staffList.filter(
        (s) => s.isAvailable !== false && !currentlyServingStaff.includes(s.name.toLowerCase())
      );
      const chosenBarber = activeBarbers[0];
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

  // 3. Apply Coupon if supplied
  let discount = 0;
  if (userData.couponCode) {
    try {
      const cv = await validateCoupon(userData.couponCode, userData.userId, businessId);
      if (cv.valid) discount = cv.discountAmount;
    } catch {
      // Ignore invalid coupon
    }
  }

  const finalDeposit = Math.max(0, price - discount);

  // Pay at business vs online wallet deduction
  const isPayAtBusiness =
    userData.paymentMethod === "PAY_AT_BUSINESS" ||
    business.paymentConfiguration?.paymentMode === "PAY_AT_BUSINESS";

  const depositCharged = isPayAtBusiness ? 0 : finalDeposit;

  // Safe atomic wallet deduction only if online payment
  if (!isPayAtBusiness && finalDeposit > 0) {
    await deductWalletBalance(
      userData.userId,
      finalDeposit,
      `Queue entry deposit at ${business.name}`,
      io
    );
  }

  // AI prediction for service duration
  const serviceTime = await predictServiceTime({
    serviceType: finalServiceType,
    userType: userData.userType || "normal",
    timeOfDay: new Date().getHours(),
    queueLength: queueDS.map.size,
    baseDuration: baseServiceTime,
  });

  queueDS.enqueue({
    userId: userData.userId,
    serviceTime,
    serviceType: finalServiceType,
    services: selectedServicesList,
    assignedStaff,
    pricingLabel: userData.pricingLabel || "",
    paidAmount: depositCharged,
  });

  queueDoc.users = queueDS.toArray();
  await queueDoc.save();

  return queueDoc;
};

// ❌ LEAVE QUEUE
export const leaveQueue = async (businessId, userId) => {
  const queueDoc = await Queue.findOne({ businessId });
  if (!queueDoc) throw new ApiError(404, "Queue not found");

  const queueDS = QueueDS.fromArray(queueDoc.users);
  queueDS.remove(userId);

  queueDoc.users = queueDS.toArray();
  await queueDoc.save();

  return queueDoc;
};

// ⏭️ CALL NEXT
export const callNext = async (businessId, requesterId, requesterRole, io) => {
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  if (requesterRole !== "admin" && business.owner.toString() !== requesterId.toString()) {
    throw new ApiError(403, "Access denied: you can only manage queues for your own business");
  }

  const queue = await Queue.findOne({ businessId });
  if (!queue || !queue.users.length) throw new ApiError(400, "Queue is already empty");

  const previousHead = queue.users[0];
  const queueDS = QueueDS.fromArray(queue.users);
  queueDS.dequeue();

  queue.users = queueDS.toArray();
  await queue.save();

  if (io) {
    // 1. Emit completed for previous head
    if (previousHead) {
      io.to(`business:${businessId}`).emit("service:completed", {
        businessId,
        userId: previousHead.userId,
        queue,
      });
    }

    // 2. Emit started for new head if present
    if (queue.users.length > 0) {
      const newServing = queue.users[0];
      io.to(`business:${businessId}`).emit("service:started", {
        businessId,
        userId: newServing.userId,
        queue,
      });
    }

    // 3. Emit queue updated
    io.to(`business:${businessId}`).emit("queue:updated", { businessId, queue });
    io.to(`business:${businessId}`).emit("queue:update", queue);

    // 4. Notify near users
    queue.users.forEach((u, index) => {
      if (index > 0 && index <= 3 && u.status === "waiting") {
        io.to(`user:${u.userId}`).emit("notification:near", {
          message: `Your turn is near! You are at position ${index + 1} at ${business.name}.`,
          businessName: business.name,
          position: index + 1,
        });
      }
    });
  }

  return queue;
};

// 📊 GET QUEUE
export const getQueue = async (businessId, io = null, requesterId = null) => {
  let queue = await Queue.findOne({ businessId });
  if (!queue) {
    queue = await Queue.create({ businessId, users: [] });
  }

  const queueDS = QueueDS.fromArray(queue.users);
  const wasCleaned = queueDS.cleanup();

  if (wasCleaned) {
    queue.users = queueDS.toArray();
    await queue.save();

    if (io) {
      io.to(`business:${businessId}`).emit("queue:update", queue);
      io.to(`business:${businessId}`).emit("queue:updated", { businessId, queue });
    }
  }

  const business = await Business.findById(businessId);
  const isOwner = requesterId && business?.owner?.toString() === requesterId.toString();

  if (isOwner) {
    queue = await Queue.findOne({ businessId }).populate("users.userId", "name email phone");
  }

  return queue;
};

// 🧠 ESTIMATE WAIT TIME
export const estimateWaitTime = async (businessId, userId) => {
  const queue = await Queue.findOne({ businessId });
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  const avgTime = business.averageServiceTime || 10;
  const users = queue?.users || [];

  const userIndex = users.findIndex(
    (u) => (u.userId?._id || u.userId)?.toString() === userId?.toString()
  );

  const peopleAhead = userIndex >= 0 ? userIndex : users.length;
  let totalMinutes = 0;
  for (let i = 0; i < peopleAhead; i++) {
    totalMinutes += users[i].serviceTime || avgTime;
  }

  const hour = new Date().getHours();
  const isPeakHour = (hour >= 10 && hour <= 13) || (hour >= 17 && hour <= 19);
  const peakMultiplier = isPeakHour ? 1.15 : 1.0;
  const finalEstimate = Math.max(1, Math.round(totalMinutes * peakMultiplier));

  return {
    estimatedWait: finalEstimate,
    peopleAhead,
    avgServiceTime: avgTime,
    isPeakHour,
    message: peopleAhead === 0
      ? "You're next! Your turn is starting shortly."
      : `Estimated wait time: ~${finalEstimate} minutes (${peopleAhead} ahead).`,
  };
};

// ⏱️ EXTEND TIME
export const extendTime = async (businessId, userId, minutes = 5, requesterId, requesterRole, io = null) => {
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  if (requesterRole !== "admin" && business.owner.toString() !== requesterId.toString()) {
    throw new ApiError(403, "Access denied: only business owners can extend queue service times");
  }

  const queue = await Queue.findOne({ businessId });
  if (!queue) throw new ApiError(404, "Queue not found");

  const queueDS = QueueDS.fromArray(queue.users);
  const node = queueDS.map.get(userId.toString());
  if (!node) throw new ApiError(404, "User not found in queue");

  node.serviceTime = (node.serviceTime || 10) + Number(minutes);
  queueDS.recalculate();
  queue.users = queueDS.toArray();
  await queue.save();

  if (io) {
    io.to(`business:${businessId}`).emit("queue:updated", { businessId, queue });
    io.to(`business:${businessId}`).emit("queue:update", queue);

    let reachedTarget = false;
    for (const u of queue.users) {
      const uId = (u.userId?._id || u.userId)?.toString();
      if (reachedTarget) {
        const rewardAmount = 10;
        await refundToWallet(uId, rewardAmount, "Queue delay compensation", io);

        io.to(`user:${uId}`).emit("booking:delayed", {
          message: `The queue has been extended by ${minutes} minutes. We've added ₹${rewardAmount} to your wallet.`,
          delay: minutes,
          reward: rewardAmount,
        });
      }
      if (uId === userId.toString()) reachedTarget = true;
    }
  }

  return queue;
};

// 🎟️ CANCEL DELAY WITH REFUND
export const handleCancelDelay = async (businessId, userId, io = null) => {
  const queueDoc = await Queue.findOne({ businessId });
  if (!queueDoc) throw new ApiError(404, "Queue not found");

  const queueDS = QueueDS.fromArray(queueDoc.users);
  const userData = queueDoc.users.find((u) => (u.userId?._id || u.userId)?.toString() === userId.toString());
  if (!userData) throw new ApiError(404, "You are not in this queue");

  const refundAmount = userData.paidAmount || 0;
  const compensationReward = 20;
  const totalCredited = refundAmount + compensationReward;

  queueDS.remove(userId);
  queueDoc.users = queueDS.toArray();
  await queueDoc.save();

  if (totalCredited > 0) {
    await refundToWallet(userId, totalCredited, "Queue cancellation refund & delay compensation", io);
  }

  if (io) {
    io.to(`business:${businessId}`).emit("queue:left", { businessId, userId, queue: queueDoc });
    io.to(`business:${businessId}`).emit("queue:updated", { businessId, queue: queueDoc });
  }

  return { queue: queueDoc, totalCredited };
};