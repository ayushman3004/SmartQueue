import Queue from "./queue.model.js";
import QueueDS from "./queue.ds.js";
import { predictServiceTime } from "../../ai/gemini.service.js";
import Business from "../modules/business/business.model.js";

// ➕ JOIN QUEUE
export const joinQueue = async (businessId, userData) => {
  let queueDoc = await Queue.findOne({ businessId });

  if (!queueDoc) {
    queueDoc = new Queue({ businessId, users: [] });
  }

  const queueDS = QueueDS.fromArray(queueDoc.users);

  // 🚫 Prevent duplicate joins
  if (queueDoc.users.some(u => (u.userId?._id || u.userId)?.toString() === userData.userId?.toString())) {
    throw new Error("You are already in this queue");
  }

  // 🧠 AI prediction
  const serviceTime = await predictServiceTime({
    serviceType: userData.serviceType,
    userType: userData.userType || "normal",
    timeOfDay: new Date().getHours(),
    queueLength: queueDS.map.size,
  });

  queueDS.enqueue({
    userId: userData.userId,
    serviceTime,
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
  queueDS.dequeue(); // remove the serving user
  queueDS.callNext(); // make next user serving

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
export const getQueue = async (businessId, io = null) => {
  const queue = await Queue.findOne({ businessId });
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

  const userRes = queue.users.find(u => (u.userId?._id || u.userId)?.toString() === userId?.toString());
  if (!userRes) throw new Error("User not found as serving");

  userRes.serviceTime = (userRes.serviceTime || 10) + Number(minutes);
  await queue.save();

  if (io) {
    io.to(`business:${businessId}`).emit("queue:update", queue);
  }
  return queue;
};