import Queue from "./queue.model.js";
import QueueDS from "./queue.ds.js";
import { predictServiceTime } from "../../ai/gemini.service.js";
import Business from "../modules/business/business.model.js";

// ➕ JOIN QUEUE
export const joinQueue = async (businessId, userData, io = null) => {
  let queueDoc = await Queue.findOne({ businessId });

  if (!queueDoc) {
    queueDoc = new Queue({ businessId, users: [] });
  }

  const business = await Business.findById(businessId);
  if (!business) throw new Error("Business not found");

  const queueDS = QueueDS.fromArray(queueDoc.users);

  // 🚫 Prevent duplicate joins
  if (queueDoc.users.some(u => (u.userId?._id || u.userId)?.toString() === userData.userId?.toString())) {
    const error = new Error("You are already in this queue");
    error.statusCode = 400;
    throw error;
  }

  // 💰 Wallet Integration
  const User = (await import("../modules/auth/auth.model.js")).default;
  const user = await User.findById(userData.userId);
  if (!user) throw new Error("User not found");

  // Determine price
  let price = business.basePrice || 0;
  const selectedServiceObj = business.services?.find(s => s.name === userData.serviceType);
  
  if (selectedServiceObj && selectedServiceObj.price !== undefined) {
    price = selectedServiceObj.price;
  } else if (userData.pricingLabel) {
    const specificPricing = business.pricing.find(p => p.label === userData.pricingLabel);
    if (specificPricing) price = specificPricing.price;
  }

  if (user.walletBalance < price) {
    const error = new Error(`Insufficient wallet balance. This hub requires ₹${price} to join.`);
    error.statusCode = 402;
    throw error;
  }

  // Deduct from wallet
  user.walletBalance -= price;
  await user.save();

  if (io) {
    io.to(`user:${user._id}`).emit("wallet:update", { balance: user.walletBalance });
  }

  // 🧠 AI prediction
  const baseServiceTime = selectedServiceObj ? selectedServiceObj.duration : (business.averageServiceTime || 10);

  const serviceTime = await predictServiceTime({
    serviceType: userData.serviceType,
    userType: userData.userType || "normal",
    timeOfDay: new Date().getHours(),
    queueLength: queueDS.map.size,
    baseDuration: baseServiceTime,
  });

  queueDS.enqueue({
    userId: userData.userId,
    serviceTime,
    pricingLabel: userData.pricingLabel || "",
    paidAmount: price || 0,
  });

  queueDoc.users = queueDS.toArray();
  await queueDoc.save();

  return queueDoc;
};
// ❌ LEAVE QUEUE
export const leaveQueue = async (businessId, userId) => {
  const queueDoc = await Queue.findOne({ businessId });
  if (!queueDoc) throw new Error("Queue not found");

  const queueDS = QueueDS.fromArray(queueDoc.users);

  queueDS.remove(userId);

  queueDoc.users = queueDS.toArray();
  await queueDoc.save();

  return queueDoc;
};

// ⏭️ CALL NEXT
export const callNext = async (businessId, io) => {
  const queue = await Queue.findOne({ businessId });
  if (!queue) throw new Error("Queue not found");

  const queueDS = QueueDS.fromArray(queue.users);
  queueDS.dequeue(); // remove the serving user. next user becomes head and is set to 'serving' automatically.

  queue.users = queueDS.toArray();
  await queue.save();

  if (io) {
    io.to(`business:${businessId}`).emit("queue:update", queue);
    
    // 🔔 Notify users who are now near the front
    queue.users.forEach((u, index) => {
      if (index > 0 && index <= 3 && u.status === 'waiting') {
        io.to(`user:${u.userId}`).emit("notification:near", {
          message: `Your turn is near! You are at position ${index + 1}.`,
          businessName: "the business" // ideally pass name
        });
      }
    });
  }

  return queue;
};

// 📊 GET QUEUE
export const getQueue = async (businessId, io = null, requesterId = null) => {
  let queue = await Queue.findOne({ businessId });
  if (!queue) throw new Error("Queue not found");

  // Logic: check for auto-exit before returning
  const queueDS = QueueDS.fromArray(queue.users);
  const wasCleaned = queueDS.cleanup();

  if (wasCleaned) {
    queue.users = queueDS.toArray();
    await queue.save();
    console.log(`🧹 Queue cleaned for business: ${businessId}`);
    
    // Broadcast update if io is provided
    if (io) {
      io.to(`business:${businessId}`).emit("queue:update", queue);
    }
  }

  // Check if requester is the owner
  const business = await Business.findById(businessId);
  const isOwner = requesterId && (business?.owner?.toString() === requesterId.toString());

  if (isOwner) {
    // Populate user names for owner
    queue = await Queue.findOne({ businessId }).populate("users.userId", "name email");
  }

  return queue;
};

// 🧠 AI WAIT TIME ESTIMATE
export const estimateWaitTime = async (businessId, userId) => {
  const queue = await Queue.findOne({ businessId });
  const business = await Business.findById(businessId);

  if (!business) throw new Error("Business not found");

  const avgTime = business.averageServiceTime || 10;
  const users = queue?.users || [];

  // Find how many people are ahead
  const userIndex = users.findIndex(
    (u) => u.userId?.toString() === userId?.toString()
  );

  // If user isn't in queue, estimate based on full queue length
  const peopleAhead = userIndex >= 0 ? userIndex : users.length;

  // Sum actual service times of users ahead (more accurate than just avg)
  let totalMinutes = 0;
  for (let i = 0; i < peopleAhead; i++) {
    totalMinutes += users[i].serviceTime || avgTime;
  }

  // AI touch: slight randomness (+/- 2 min)
  const jitter = Math.round((Math.random() - 0.5) * 4); // -2 to +2
  const estimatedWait = Math.max(1, Math.round(totalMinutes + jitter));

  // Time-of-day factor (busier during peak hours)
  const hour = new Date().getHours();
  const isPeakHour = (hour >= 10 && hour <= 13) || (hour >= 17 && hour <= 19);
  const peakMultiplier = isPeakHour ? 1.15 : 1.0;
  const finalEstimate = Math.max(1, Math.round(estimatedWait * peakMultiplier));

  console.log(`\n📊 AI Wait Estimate:`, {
    businessId,
    userId: userId?.toString(),
    peopleAhead,
    totalServiceMins: totalMinutes,
    jitter,
    isPeakHour,
    peakMultiplier,
    finalEstimate,
  });

  return {
    estimatedWait: finalEstimate,
    peopleAhead,
    avgServiceTime: avgTime,
    isPeakHour,
    message: peopleAhead === 0
      ? "You're next! Your turn should be very soon."
      : `Wait for approximately ${finalEstimate} minutes for your turn`,
  };
};

export const extendTime = async (businessId, userId, minutes = 5, io = null) => {
  const queue = await Queue.findOne({ businessId });
  if (!queue) throw new Error("Queue not found");

  const queueDS = QueueDS.fromArray(queue.users);
  const node = queueDS.map.get(userId.toString());
  if (!node) throw new Error("User not found in queue");

  node.serviceTime = (node.serviceTime || 10) + Number(minutes);
  queueDS.recalculate();
  queue.users = queueDS.toArray();
  await queue.save();

  if (io) {
    io.to(`business:${businessId}`).emit("queue:update", queue);
    let reachedTarget = false;
    
    // Compensation Logic
    const User = (await import("../modules/auth/auth.model.js")).default;
    
    for (const u of queue.users) {
      const uId = (u.userId?._id || u.userId)?.toString();
      if (reachedTarget) {
        // Add reward to wallet for delay
        const rewardAmount = 10; 
        await User.findByIdAndUpdate(uId, { $inc: { walletBalance: rewardAmount } });

        io.to(`user:${uId}`).emit("queue:delay", {
          message: `Your appointment is delayed by ${minutes} minutes. We've added ₹${rewardAmount} to your wallet!`,
          delay: minutes,
          reward: rewardAmount
        });
      }
      if (uId === userId.toString()) reachedTarget = true;
    }
  }
  return queue;
};

// 🎟️ HANDLE CANCEL WITH REFUND
export const handleCancelDelay = async (businessId, userId, io = null) => {
  const queueDoc = await Queue.findOne({ businessId });
  if (!queueDoc) throw new Error("Queue not found");

  const queueDS = QueueDS.fromArray(queueDoc.users);
  const userData = queueDoc.users.find(u => (u.userId?._id || u.userId)?.toString() === userId.toString());
  if (!userData) throw new Error("You are not in this queue.");

  const refundAmount = userData.paidAmount || 0;
  const compensationReward = 20; // Extra 20 for the trouble
  const totalCredited = refundAmount + compensationReward;

  queueDS.remove(userId);
  queueDoc.users = queueDS.toArray();
  await queueDoc.save();

  // Refund directly to wallet
  const User = (await import("../modules/auth/auth.model.js")).default;
  const user = await User.findById(userId);
  if (user) {
    user.walletBalance += totalCredited;
    await user.save();
    
    if (io) {
      io.to(`user:${userId}`).emit("wallet:update", { balance: user.walletBalance });
    }
  }

  return { queue: queueDoc, totalCredited };
};