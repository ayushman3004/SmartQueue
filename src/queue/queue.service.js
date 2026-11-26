import { publishQueue, queueForViewer, queueForOwner } from "./queue.view.js";
import { canAccessOwnerCategory } from "../utils/ownerCategory.js";
import { notifyUser, notifyServingTurns } from '../modules/notification/notification.service.js';
import { assertTestVenueAccess } from '../modules/admin/admin-workspace.service.js';
import { isClinic, isAssignedToDoctor, requireAssigned, ref } from "../modules/doctor/doctor-access.js";
import mongoose from "mongoose";
import Queue from "./queue.model.js";
import QueueDS from "./queue.ds.js";
import { predictServiceTime } from "../../ai/openai.service.js";
import Business from "../modules/business/business.model.js";
import Booking from "../booking/booking.model.js";
import ApiError from "../../utils/ApiError.js";
import { validateCoupon } from "../modules/coupon/coupon.service.js";
import { isBusinessSubscriptionActive } from "../modules/subscription/subscription.service.js";
import { cancelWalkIn } from './walk-in.service.js';

//  JOIN QUEUE
export const joinQueue = async (businessId, userData, io = null, attempt = 0) => {
  let queueDoc = await Queue.findOne({ businessId });
  if (!queueDoc) {
    queueDoc = new Queue({ businessId, users: [] });
  }

  const business = await Business.findById(businessId);
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");
  assertTestVenueAccess(business, userData.userId);
  if (!business.isOpen || !business.isActive) {
    throw new ApiError(400, "This business is currently closed or not accepting queue entries");
  }

  // Validate that business has an active ServeQ subscription
  const isSubscribed = await isBusinessSubscriptionActive(business);
  if (!isSubscribed) {
    throw new ApiError(
      403,
      "This venue is currently not accepting queue entries because its ServeQ subscription is inactive."
    );
  }

  // Validate business queue preferences
  if (business.queueSettings?.enableLiveQueue === false) {
    throw new ApiError(403, "Live queue is currently disabled for this business");
  }

  const maxCap = business.queueSettings?.maxQueueCapacity || 50;
  //  Prevent duplicate joins
  if (queueDoc.users.some((u) => (u.userId?._id || u.userId)?.toString() === userData.userId?.toString())) {
    throw new ApiError(400, "You are already in this queue");
  }
  if (queueDoc.users.length >= maxCap) {
    throw new ApiError(400, `Live queue has reached maximum capacity of ${maxCap} patrons.`);
  }

  const queueDS = QueueDS.fromArray(queueDoc.users);

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

  // 2. Staff Assignment (Doctor) with auto-fallback
  const roster = Array.isArray(business.staff) ? business.staff : [];
  const registeredDoctors = roster.filter(staff => staff.email && staff.doctorId);
  const staffList = registeredDoctors.length ? registeredDoctors : roster;
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

  // Check requested doctor
  if (staffNameRequested && staffNameRequested.toLowerCase() !== "any") {
    const candidate = staffList.find(
      (s) => s.name.toLowerCase() === staffNameRequested.toLowerCase() && s.isAvailable !== false
    );
    if (candidate) {
      assignedStaff = {
        staffId: candidate._id,
        name: candidate.name,
        role: candidate.role || "Doctor / Specialist",
        specialties: candidate.specialties || "",
        autoAssigned: false,
      };
    }
  }

  // Auto-fallback if requested staff unavailable or not specified ('any')
  if (!assignedStaff) {
    const availableStaff = staffList.filter((s) => s.isAvailable !== false);
    if (availableStaff.length > 0) {
      // Find the available staff member with the least rush in their personal queue
      const staffLoads = availableStaff.map((staffMember) => {
        const staffKey = staffMember.name.toLowerCase().trim();
        const queuedForStaff = queueDoc.users.filter(
          (u) => (u.assignedStaff?.name || "").toLowerCase().trim() === staffKey
        );
        const isServing =
          queuedForStaff.some((u) => u.status === "serving") ||
          currentlyServingStaff.includes(staffKey);
        return {
          staff: staffMember,
          queueCount: queuedForStaff.length,
          isServing,
        };
      });

      // Sort: 1) free/not serving first, 2) fewest total queued
      staffLoads.sort((a, b) => {
        if (a.isServing !== b.isServing) {
          return a.isServing ? 1 : -1;
        }
        return a.queueCount - b.queueCount;
      });

      const chosen = staffLoads[0].staff;
      assignedStaff = {
        staffId: chosen._id,
        name: chosen.name,
        role: chosen.role || "Doctor / Specialist",
        specialties: chosen.specialties || "",
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

  // Live queue walk-in entries default to counter settlement upon arrival
  const depositCharged = 0;

  // AI prediction for service duration
  const serviceTime = await predictServiceTime({
    serviceType: finalServiceType,
    userType: userData.userType || "normal",
    timeOfDay: new Date().getHours(),
    queueLength: queueDS.map.size,
    baseDuration: baseServiceTime,
  });

  const staffKey = (assignedStaff?.name || "").toLowerCase().trim();
  const staffCurrentlyServing = queueDoc.users.some(
    (u) => (u.assignedStaff?.name || "").toLowerCase().trim() === staffKey
  ) || currentlyServingStaff.includes(staffKey);

  const initialStatus = staffCurrentlyServing ? "waiting" : "serving";
  const now = new Date();
  const servicePrice = Math.max(Number(depositCharged) || 0, Number(price) || 0);

  // Direct queue join creates a Booking record immediately so it counts as an appointment/booking,
  // appears in customer history, and reflects in business hub revenue and analytics
  let createdBooking = null;
  try {
    const sanitizedServices = (selectedServicesList || []).map((s) => ({
      name: s.name || finalServiceType || "General Service",
      duration: Math.max(1, Number(s.duration) || 15),
      price: Math.max(0, Number(s.price) || 0),
    }));

    createdBooking = await Booking.create({
      businessId,
      userId: userData.userId,
      startTime: now,
      endTime: new Date(now.getTime() + Math.max(1, Number(serviceTime) || 15) * 60000),
      duration: Math.max(1, Number(serviceTime) || 15),
      serviceType: finalServiceType || "General Service",
      services: sanitizedServices,
      assignedStaff: assignedStaff || { name: "", role: "" },
      status: initialStatus,
      paidAmount: servicePrice,
      paymentMethod: "counter",
      paymentStatus: "pending",
      pricingLabel: userData.pricingLabel || "",
      notes: userData.notes || "Direct Live Queue Entry",
    });
  } catch (bErr) {
    console.error("Warning: could not create booking for direct queue entry:", bErr);
    if (bErr.code === 11000) {
      try {
        await mongoose.connection.collection("bookings").dropIndex("businessId_1_userId_1_scheduledAt_1");
        createdBooking = await Booking.create({
          businessId,
          userId: userData.userId,
          startTime: now,
          endTime: new Date(now.getTime() + Math.max(1, Number(serviceTime) || 15) * 60000),
          duration: Math.max(1, Number(serviceTime) || 15),
          serviceType: finalServiceType || "General Service",
          services: (selectedServicesList || []).map((s) => ({
            name: s.name || finalServiceType || "General Service",
            duration: Math.max(1, Number(s.duration) || 15),
            price: Math.max(0, Number(s.price) || 0),
          })),
          assignedStaff: assignedStaff || { name: "", role: "" },
          status: initialStatus,
          paidAmount: servicePrice,
          paymentMethod: "counter",
          paymentStatus: "pending",
          pricingLabel: userData.pricingLabel || "",
          notes: userData.notes || "Direct Live Queue Entry",
        });
      } catch (retryErr) {
        console.error("Retry creating booking failed:", retryErr);
      }
    }
  }

  queueDS.enqueue({
    userId: userData.userId,
    bookingId: createdBooking?._id || null,
    serviceTime,
    serviceType: finalServiceType,
    services: selectedServicesList,
    assignedStaff,
    pricingLabel: userData.pricingLabel || "",
    paidAmount: servicePrice,
    paymentMethod: "counter",
    paymentStatus: "pending",
  });

  queueDoc.users = queueDS.toArray();
  try {
    await queueDoc.save();
  } catch (error) {
    if (!['VersionError', 'DocumentNotFoundError'].includes(error.name) && error.code !== 11000) throw error;
    if (createdBooking) await Booking.deleteOne({ _id: createdBooking._id });
    if (attempt < 2) return joinQueue(businessId, userData, io, attempt + 1);
    throw new ApiError(409, 'The live queue changed. Try joining again.');
  }
  await notifyServingTurns(business, queueDoc.users, io);

  if (io) {
    io.to(`business:${businessId}`).emit("bookings:updated");
    if (createdBooking) {
      io.to(`user:${userData.userId}`).emit("booking:confirmed", { booking: createdBooking });
    }
  }

  return queueDoc;
};

//  LEAVE QUEUE
export const leaveQueue = async (businessId, userId, io = null) => {
  const queueDoc = await Queue.findOne({ businessId });
  if (!queueDoc) throw new ApiError(404, "Queue not found");

  const leavingUser = queueDoc.users.find(
    (u) => (u.userId?._id || u.userId)?.toString() === userId.toString()
  );
  if (leavingUser?.walkIn) return (await cancelWalkIn(leavingUser.bookingId, userId)).queue;

  if (leavingUser) {
    try {
      let booking = null;
      if (leavingUser.bookingId) {
        booking = await Booking.findById(leavingUser.bookingId);
      }
      if (!booking) {
        booking = await Booking.findOne({
          businessId,
          userId: leavingUser.userId?._id || leavingUser.userId,
          status: { $in: ["waiting", "serving", "confirmed"] },
        }).sort({ createdAt: -1 });
      }

      if (booking && !["completed", "cancelled", "refunded"].includes(booking.status)) {
        booking.status = (booking.paidAmount > 0 || booking.paymentStatus === "paid") ? "refunded" : "cancelled";
        await booking.save();
        if (io) {
          io.to(`business:${businessId}`).emit("bookings:updated");
        }
      }
    } catch (err) {
      console.error("Error updating booking on leaveQueue:", err);
    }
  }

  const queueDS = QueueDS.fromArray(queueDoc.users);
  queueDS.remove(userId);

  queueDoc.users = queueDS.toArray();
  await queueDoc.save();
  const business = await Business.findById(businessId);
  if (isClinic(business)) await notifyServingTurns(business, queueDoc.users, io);

  return queueDoc;
};

// ⏭️ CALL NEXT
export const callNext = async (businessId, requesterId, requesterRole, io, staffName, targetUserId, autoCompleteAt = null, doctor = null, attempt = 0) => {
  const business = await Business.findById(businessId);
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");

  if (requesterRole !== "admin" && business.owner.toString() !== requesterId.toString()) {
    throw new ApiError(403, "Access denied: you can only manage queues for your own business");
  }

  const queue = await Queue.findOne({ businessId });
  if (!queue || !queue.users.length) throw new ApiError(400, "Queue is already empty");

  let previousHead = null;
  if (targetUserId) {
    const tId = targetUserId.toString();
    previousHead = queue.users.find((u) => (u.userId?._id || u.userId)?.toString() === tId);
  }
  if (attempt && !previousHead) return queue;
  if (doctor) {
    requireAssigned(previousHead, doctor);
    if (previousHead.status !== "serving") throw new ApiError(409, "This consultation is no longer active.");
  }
  // Background completion must never fall through to a different customer or ignore an extension.
  if (autoCompleteAt) {
    const start = previousHead?.estimatedStartTime || previousHead?.joinedAt;
    const finish = new Date(start).getTime() + Math.max(1, Number(previousHead?.serviceTime) || 15) * 60000;
    if (!previousHead || previousHead.status !== "serving" || !Number.isFinite(finish) || finish > autoCompleteAt.getTime()) {
      return queue;
    }
  }
  if (!previousHead && staffName) {
    previousHead = queue.users.find(
      (u) => u.status === "serving" && (u.assignedStaff?.name || "").toLowerCase().trim() === staffName.toLowerCase().trim()
    );
  }
  if (!previousHead) {
    previousHead = queue.users.find((u) => u.status === "serving") || queue.users[0];
  }
  if (previousHead.walkIn && previousHead.status !== 'serving') throw new ApiError(409, 'Call the patient before completing the visit.');
  const uId = previousHead.userId?._id || previousHead.userId;

  // Calculate earnings and details for the finished user
  const totalServicePrice = (previousHead.services || []).reduce(
    (sum, s) => sum + (Number(s.price) || 0),
    0
  ) || business.basePrice || previousHead.paidAmount || 0;
  const finalAmountEarned = Math.max(Number(previousHead.paidAmount) || 0, Number(totalServicePrice) || 0);

  const startTime = previousHead.joinedAt || new Date(Date.now() - (Number(previousHead.serviceTime) || 15) * 60000);
  const endTime = new Date();

  // Create or update completed booking record so service history, revenue, analytics, and rating options are populated
  let completedBooking = null;
  let recordedCompletion = false;
  if (uId) {
    try {
      if (previousHead.bookingId) {
        completedBooking = await Booking.findById(previousHead.bookingId);
      }

      // Fallback: if bookingId wasn't stored or not found, find an active/waiting booking for this user and business
      if (!completedBooking) {
        completedBooking = await Booking.findOne({
          businessId,
          userId: uId,
          status: { $in: ["serving", "waiting", "confirmed"] },
        }).sort({ createdAt: -1 });
      }

      if (doctor && completedBooking) requireAssigned(completedBooking, doctor);
      if (completedBooking) {
        const claimed = await Booking.findOneAndUpdate({
          _id: completedBooking._id,
          status: { $nin: ["completed", "cancelled", "refunded"] },
        }, { $set: {
          status: "completed", endTime,
          paidAmount: completedBooking.paidAmount || finalAmountEarned,
        } }, { new: true });
        recordedCompletion = Boolean(claimed);
        completedBooking = claimed || await Booking.findById(completedBooking._id);
      } else {
        // Build clean sanitized services array
        const sanitizedServices = (previousHead.services || []).map((s) => ({
          name: s.name || previousHead.serviceType || "General Service",
          duration: Math.max(1, Number(s.duration) || 15),
          price: Math.max(0, Number(s.price) || 0),
        }));
        if (sanitizedServices.length === 0) {
          sanitizedServices.push({
            name: previousHead.serviceType || "General Service",
            duration: Math.max(1, Number(previousHead.serviceTime) || 15),
            price: finalAmountEarned,
          });
        }

        completedBooking = await Booking.create({
          businessId,
          userId: uId,
          startTime,
          endTime,
          duration: Math.max(1, Number(previousHead.serviceTime) || business.averageServiceTime || 15),
          serviceType: previousHead.serviceType || "General Service",
          services: sanitizedServices,
          assignedStaff: previousHead.assignedStaff ? {
            staffId: previousHead.assignedStaff.staffId,
            name: previousHead.assignedStaff.name || "",
            role: previousHead.assignedStaff.role || "",
            specialties: previousHead.assignedStaff.specialties || "",
            autoAssigned: Boolean(previousHead.assignedStaff.autoAssigned),
          } : { name: "", role: "", specialties: "", autoAssigned: false },
          status: "completed",
          paidAmount: finalAmountEarned,
          pricingLabel: previousHead.pricingLabel || "",
          notes: "Direct Live Queue Entry - Completed",
        });
        recordedCompletion = true;
      }

      // Update staff member customersServed count
      if (recordedCompletion && previousHead.assignedStaff?.name && Array.isArray(business.staff)) {
        const staffMember = business.staff.find(
          (s) => s.name?.toLowerCase() === previousHead.assignedStaff.name.toLowerCase()
        );
        if (staffMember) {
          staffMember.customersServed = (staffMember.customersServed || 0) + 1;
          await business.save();
        }
      }
    } catch (saveErr) {
      if (doctor) throw saveErr;
      console.error("Error creating/updating completed booking from queue session:", saveErr);
      // Keep the entry in place so the background worker can retry a failed write.
      if (autoCompleteAt) throw saveErr;
      if (saveErr.code === 11000) {
        try {
          await mongoose.connection.collection("bookings").dropIndex("businessId_1_userId_1_scheduledAt_1");
          completedBooking = await Booking.create({
            businessId,
            userId: uId,
            startTime,
            endTime,
            duration: Math.max(1, Number(previousHead.serviceTime) || business.averageServiceTime || 15),
            serviceType: previousHead.serviceType || "General Service",
            services: [{ name: previousHead.serviceType || "General Service", duration: 15, price: finalAmountEarned }],
            assignedStaff: previousHead.assignedStaff || { name: "", role: "" },
            status: "completed",
            paidAmount: finalAmountEarned,
          });
        } catch (retryErr) {
          console.error("Retry booking completion failed:", retryErr);
        }
      }
    }
  }

  // Dequeue user and update queue state
  const queueDS = QueueDS.fromArray(queue.users);
  queueDS.remove(uId);
  if (doctor) {
    const next = queueDS.toArray().find(row => isAssignedToDoctor(row, doctor));
    if (next?.walkIn) startWalkInNode(queueDS.map.get(ref(next.userId)));
    queueDS.recalculate();
  }

  queue.users = queueDS.toArray();
  try { await queue.save(); }
  catch (error) {
    if (error.name !== 'VersionError') throw error;
    if (attempt < 2) return callNext(businessId, requesterId, requesterRole, io, staffName, uId, autoCompleteAt, doctor, attempt + 1);
    throw new ApiError(409, 'The queue changed. Refresh before calling the next patient.');
  }
  await notifyServingTurns(business, queue.users, io);

  // Update any newly serving users' bookings to serving in database
  for (const u of queue.users) {
    if (u.status === "serving" && u.bookingId) {
      try {
        const startTime = new Date(u.estimatedStartTime || Date.now());
        await Booking.findByIdAndUpdate(u.bookingId, {
          status: "serving",
          startTime,
          endTime: new Date(startTime.getTime() + Math.max(1, Number(u.serviceTime) || 15) * 60000),
        });
      } catch {
        // Non-critical
      }
    }
  }

  if (io) {
    io.to(`business:${businessId}`).emit("bookings:updated");
    // 1. Emit completed for previous head
    if (previousHead && completedBooking?.status === "completed") {
      const uId = previousHead.userId?._id || previousHead.userId;
      io.to(`business:${businessId}`).emit("service:completed", {
        businessId,
      });
      if (uId) {
        io.to(`user:${uId}`).emit("bookings:updated");
        io.to(`user:${uId}`).emit("service:completed", {
          businessId,
          businessName: business.name,
          booking: completedBooking,
          message: `Your service at ${business.name} has been completed! Please take a moment to leave a rating.`,
        });
      }
    }

    // 2. Emit started for new head if present
    const newServing = doctor
      ? queue.users.find(row => row.status === "serving" && isAssignedToDoctor(row, doctor))
      : queue.users[0];
    if (newServing) {
      io.to(`business:${businessId}`).emit("service:started", {
        businessId,
      });
    }

    // 3. Emit queue updated
    publishQueue(io, businessId, queue);
    io.to(`business:${businessId}:admin`).emit("bookings:updated");
    for (const user of queue.users) {
      io.to(`user:${user.userId?._id || user.userId}`).emit("bookings:updated");
    }

  }

  // Persist one near-turn alert per queue entry, even if the customer is offline.
  await Promise.all(queue.users.map(async (entry, index) => {
    if (index < 1 || index > 3 || entry.status !== 'waiting') return;
    const recipient = entry.userId?._id || entry.userId;
    // QueueDS rebuilds subdocument IDs; booking/join time survives reordering.
    const visit = entry.bookingId || new Date(entry.joinedAt).getTime();
    const message = `Your turn is near! You are at position ${index + 1} at ${business.name}.`;
    await notifyUser({ recipient, type: 'queue', title: 'Your turn is coming up', message,
      href: `/queue/${businessId}`, eventKey: `queue:near:${businessId}:${visit}:${recipient}` }, io);
  }));

  return queue;
};

//  GET QUEUE
export const getQueue = async (businessId, io = null, viewer = null) => {
  const business = await Business.findById(businessId);
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");
  assertTestVenueAccess(business, viewer?._id);
  let queue = await Queue.findOne({ businessId });
  if (!queue) {
    try { queue = await Queue.create({ businessId, users: [] }); }
    catch (error) {
      if (error.code !== 11000) throw error;
      queue = await Queue.findOne({ businessId });
    }
  }

  const queueDS = QueueDS.fromArray(queue.users);
  const wasCleaned = queueDS.cleanup();

  if (wasCleaned) {
    queue.users = queueDS.toArray();
    await queue.save();

    publishQueue(io, businessId, queue);
  }

  if (wasCleaned) await notifyServingTurns(business, queue.users, io);
  const managesQueue = viewer?.role === "admin" || (
    viewer?.role === "owner" && business.approvalStatus === "approved" &&
    String(business.owner) === String(viewer._id) && canAccessOwnerCategory(viewer, business)
  );
  if (viewer?.role === 'admin') return queue.populate('users.userId', 'name email phone');
  if (managesQueue) return queueForOwner(await queue.populate('users.userId', 'name'));
  return queueForViewer(queue, viewer?.role === 'customer' ? viewer._id : undefined);
};

function startWalkInNode(node) {
  node.status = 'serving';
  node.estimatedStartTime = new Date();
}

export async function startWalkInVisit(patientId, doctor, io) {
  const businessId = doctor.business._id;
  const queue = await mongoose.connection.transaction(async session => {
    const current = await Queue.findOne({ businessId }).session(session);
    const first = current?.users.find(row => isAssignedToDoctor(row, doctor));
    if (!first?.walkIn || first.status !== 'waiting' || ref(first.userId) !== ref(patientId)) {
      throw new ApiError(409, 'Call the first waiting patient when your queue is free.');
    }
    const busy = await Booking.exists({ businessId, 'assignedStaff.staffId': doctor.staff._id,
      status: { $in: ['serving', 'in-progress'] } }).session(session);
    if (busy) throw new ApiError(409, 'Complete your active consultation before calling the next patient.');
    const queueDS = QueueDS.fromArray(current.users);
    const node = queueDS.map.get(ref(patientId));
    startWalkInNode(node);
    queueDS.recalculate();
    const startTime = node.estimatedStartTime;
    const booking = await Booking.findOneAndUpdate({ _id: first.bookingId, businessId, status: 'waiting', 'assignedStaff.staffId': doctor.staff._id },
      { $set: { status: 'serving', startTime, endTime: new Date(startTime.getTime() + node.serviceTime * 60_000) } }, { session });
    if (!booking) throw new ApiError(409, 'This visit has already changed.');
    current.users = queueDS.toArray();
    return current.save({ session });
  });
  publishQueue(io, businessId, queue);
  await notifyServingTurns(doctor.business, queue.users, io);
}

//  ESTIMATE WAIT TIME
export const estimateWaitTime = async (businessId, userId) => {
  const queue = await Queue.findOne({ businessId });
  const business = await Business.findById(businessId);
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");

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
export const extendTime = async (businessId, userId, minutes = 5, requesterId, requesterRole, io = null, doctor = null) => {
  const business = await Business.findById(businessId);
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");

  if (requesterRole !== "admin" && business.owner.toString() !== requesterId.toString()) {
    throw new ApiError(403, "Access denied: only business owners can extend queue service times");
  }

  const queue = await Queue.findOne({ businessId });
  if (!queue) throw new ApiError(404, "Queue not found");

  const queueDS = QueueDS.fromArray(queue.users);
  const node = queueDS.map.get(userId.toString());
  if (!node) throw new ApiError(404, "User not found in queue");

  if (doctor) requireAssigned(node, doctor);

  node.serviceTime = (node.serviceTime || 10) + Number(minutes);
  queueDS.recalculate();
  queue.users = queueDS.toArray();
  await queue.save();

  if (io) publishQueue(io, businessId, queue);

  const targetIndex = queue.users.findIndex(user => String(user.userId?._id || user.userId) === String(userId));
  if (targetIndex === -1) return queue;
  const targetVisit = new Date(node.joinedAt).getTime();
  const affected = queue.users.slice(targetIndex + 1).filter(user => user.status === 'waiting' && (!doctor || isAssignedToDoctor(user, doctor)));
  await Promise.all(affected.map(user => {
    const recipient = user.userId?._id || user.userId;
    const message = `The queue has been extended by ${minutes} minutes. Thank you for your patience.`;
    io?.to(`user:${recipient}`).emit("booking:delayed", { message, delay: minutes });
    return notifyUser({
      recipient, type: 'queue', title: 'Queue delayed', message,
      href: `/queue/${businessId}`,
      eventKey: `queue:delay:${businessId}:${userId}:${targetVisit}:${node.serviceTime}:${new Date(user.joinedAt).getTime()}`,
    }, io);
  }));

  return queue;
};

// ── CANCEL QUEUE ENTRY ──
export const handleCancelDelay = async (businessId, userId, io = null) => {
  const queueDoc = await Queue.findOne({ businessId });
  if (!queueDoc) throw new ApiError(404, "Queue not found");

  const queueDS = QueueDS.fromArray(queueDoc.users);
  const userData = queueDoc.users.find((u) => (u.userId?._id || u.userId)?.toString() === userId.toString());
  if (!userData) throw new ApiError(404, "You are not in this queue");

  queueDS.remove(userId);
  queueDoc.users = queueDS.toArray();
  await queueDoc.save();

  if (io) {
    io.to(`user:${userId}`).emit("queue:left", { businessId, userId });
  }

  return { queue: queueDoc, totalCredited: 0 };
};

// ASSIGN STAFF (DOCTOR / SPECIALIST)
export const assignStaff = async (businessId, userId, staffName, requesterId, requesterRole, io = null) => {
  const business = await Business.findById(businessId);
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");

  if (requesterRole !== "admin" && business.owner.toString() !== requesterId.toString()) {
    throw new ApiError(403, "Access denied: you can only manage queues for your own business");
  }

  const queue = await Queue.findOne({ businessId });
  if (!queue) throw new ApiError(404, "Queue not found");

  const staffMember = (business.staff || []).find(
    (s) => s.name?.toLowerCase() === staffName?.toLowerCase()
  );

  const queueDS = QueueDS.fromArray(queue.users);
  let current = queueDS.head;
  let found = false;

  while (current) {
    const curUserId = current.userId?._id || current.userId;
    if (curUserId?.toString() === userId?.toString()) {
      current.assignedStaff = {
        staffId: staffMember?._id,
        name: staffMember ? staffMember.name : staffName,
        role: staffMember?.role || "Doctor / Specialist",
        specialties: staffMember?.specialties || "",
        autoAssigned: false,
      };
      found = true;
      break;
    }
    current = current.next;
  }

  if (found) {
    queue.users = queueDS.toArray();
  } else {
    const u = queue.users.find(
      (usr) => (usr.userId?._id || usr.userId)?.toString() === userId?.toString()
    );
    if (u) {
      u.assignedStaff = {
        staffId: staffMember?._id,
        name: staffMember ? staffMember.name : staffName,
        role: staffMember?.role || "Doctor / Specialist",
        specialties: staffMember?.specialties || "",
        autoAssigned: false,
      };
    }
  }

  await queue.save();
  await notifyServingTurns(business, queue.users, io);
  const assigned = queue.users.find(entry => String(entry.userId?._id || entry.userId) === String(userId));
  if (assigned?.bookingId) {
    await Booking.updateOne({ _id: assigned.bookingId, businessId, userId }, { $set: { assignedStaff: assigned.assignedStaff } });
  }

  const populatedQueue = await Queue.findOne({ businessId }).populate(
    "users.userId",
    "name email phone"
  );

  if (io) {
    publishQueue(io, businessId, populatedQueue);
  }

  return populatedQueue;
};

/**
 * Accept & mark payment as paid at counter for an active live queue patron
 */
export const collectQueuePayment = async (businessId, userId, staffUser, io = null, doctor = null) => {
  const business = await Business.findById(businessId);
  if (!isClinic(business)) throw new ApiError(404, "Clinic not found");

  const businessOwnerId = (business.owner?._id || business.owner || business.ownerId)?.toString();
  if (
    staffUser.role !== "admin" &&
    businessOwnerId !== (staffUser._id || staffUser.id)?.toString()
  ) {
    throw new ApiError(403, "Not authorized to collect payment for this business");
  }

  const queue = await Queue.findOne({ businessId });
  if (!queue) throw new ApiError(404, "Queue not found");

  const queueUser = queue.users.find(
    (u) => (u.userId?._id || u.userId)?.toString() === userId.toString()
  );

  if (!queueUser) {
    throw new ApiError(404, "User not found in queue");
  }

  if (doctor) {
    requireAssigned(queueUser, doctor);
    if (queueUser.paymentStatus !== "pending" || queueUser.paymentMethod !== "counter") throw new ApiError(409, "This payment cannot be recorded at the counter.");
  }
  queueUser.paymentStatus = "paid";
  queueUser.paymentMethod = "counter";

  // Update corresponding Booking if attached or found
  let booking = null;
  if (queueUser.bookingId) {
    booking = await Booking.findById(queueUser.bookingId);
  } else {
    booking = await Booking.findOne({
      businessId,
      userId,
      status: { $in: ["waiting", "serving", "scheduled", "confirmed"] },
    }).sort({ createdAt: -1 });
  }

  if (doctor && booking) {
    requireAssigned(booking, doctor);
    if (booking.paymentStatus !== "pending") throw new ApiError(409, "This booking payment has already changed.");
  }
  if (booking) {
    booking.paymentStatus = "paid";
    booking.paymentMethod = "counter";
    booking.collectedByStaff = true;
    booking.collectedAt = new Date();
    booking.paidAmount = booking.paidAmount || queueUser.paidAmount || 0;
    await booking.save();
  }

  await queue.save();

  const populatedQueue = await Queue.findOne({ businessId }).populate(
    "users.userId",
    "name email phone"
  );

  if (io) {
    publishQueue(io, businessId, populatedQueue);
    io.to(`business:${businessId}`).emit("bookings:updated");
    io.to(`user:${userId}`).emit("queue:payment_collected", {
      businessId,
      userId,
      paidAmount: queueUser.paidAmount,
      paymentStatus: "paid",
    });
  }

  return populatedQueue;
};
