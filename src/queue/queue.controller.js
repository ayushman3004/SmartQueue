import * as queueService from "./queue.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const emitQueueUpdate = async (req, businessId, queueDoc) => {
  const io = req.app.get("io");
  if (!io) return;

  // 1. Send standard update to public room (privacy preserved)
  io.to(`business:${businessId}`).emit("queue:update", queueDoc);
  io.to(`business:${businessId}`).emit("queue:updated", { queueId: queueDoc._id, businessId, queue: queueDoc });
  io.to(`business:${businessId}`).emit("queue:etaUpdated", { queueId: queueDoc._id, businessId, queue: queueDoc });

  // 2. Send detailed update to admin room (populated with customer names)
  try {
    const adminQueue = await queueDoc.constructor.findById(queueDoc._id)
      .populate("users.userId", "name email");
    if (adminQueue) {
      io.to(`business:${businessId}:admin`).emit("queue:update", adminQueue);
    }
  } catch (err) {
    console.error("❌ Admin socket emission failed:", err.message);
  }
};

// GET /api/queue/:businessId
export const getQueue = asyncHandler(async (req, res) => {
  const io = req.app.get("io");
  let requesterId = null;

  // Manual token extraction for public/private view toggle
  const token = (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) 
    ? req.headers.authorization.split(" ")[1] 
    : req.cookies?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      requesterId = decoded.id;
    } catch (err) {
      // Token invalid, treat as public
    }
  }

  const queue = await queueService.getQueue(req.params.businessId, io, requesterId);
  res.json(new ApiResponse(200, { queue }));
});

// POST /api/queue/:businessId/join
export const join = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { serviceType, userType, pricingLabel } = req.body;

  const io = req.app.get("io");
  const queue = await queueService.joinQueue(businessId, {
    userId: req.user._id,
    serviceType: serviceType || "general",
    userType: userType || "normal",
    pricingLabel,
  }, io);

  emitQueueUpdate(req, businessId, queue);
  if (io) {
    io.to(`business:${businessId}`).emit("queue:joined", { businessId, queueId: queue._id, userId: req.user._id, queue });
  }
  res.status(200).json(new ApiResponse(200, { queue }, "Joined queue"));
});

// DELETE /api/queue/:businessId/leave
export const leave = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const queue = await queueService.leaveQueue(businessId, req.user._id);
  const io = req.app.get("io");
  emitQueueUpdate(req, businessId, queue);
  if (io) {
    io.to(`business:${businessId}`).emit("queue:left", { businessId, queueId: queue._id, userId: req.user._id, queue });
  }
  res.json(new ApiResponse(200, { queue }, "Left queue"));
});

// POST /api/queue/:businessId/next  (owner only)
export const callNext = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const io = req.app.get("io");
  const queue = await queueService.callNext(businessId, io);
  if (io) {
    io.to(`business:${businessId}`).emit("queue:serviceStarted", { businessId, queueId: queue._id, queue });
    io.to(`business:${businessId}`).emit("queue:serviceCompleted", { businessId, queueId: queue._id, queue });
  }
  res.json(new ApiResponse(200, { queue }, "Called next user"));
});

// GET /api/queue/estimate/:businessId  (authenticated user)
export const estimate = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const estimation = await queueService.estimateWaitTime(
    businessId,
    req.user._id
  );
  res.json(new ApiResponse(200, { estimation }, estimation.message));
});

// POST /api/queue/:businessId/extend (owner only)
export const extend = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { userId, minutes } = req.body;
  const io = req.app.get("io");
  const queue = await queueService.extendTime(businessId, userId, minutes, io);
  
  if (io) {
    const eventName = Number(minutes) > 15 ? "extension:paid" : "extension:free";
    io.to(`business:${businessId}`).emit(eventName, { businessId, queueId: queue._id, userId, minutes, queue });
  }

  res.json(new ApiResponse(200, { queue }, "Extended service time"));
});

// POST /api/queue/:businessId/cancel-delay (user only)
export const cancelDelay = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const io = req.app.get("io");

  const { queue, totalCredited } = await queueService.handleCancelDelay(businessId, req.user._id, io);
  res.status(200).json(new ApiResponse(200, { queue }, `Cancelled and refunded ₹${totalCredited} to your wallet`));
});
