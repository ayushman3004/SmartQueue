import * as queueService from "./queue.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const emitQueueUpdate = async (req, businessId, queueDoc) => {
  const io = req.app.get("io");
  if (!io) return;

  // 1. Standard public queue update (privacy preserved)
  io.to(`business:${businessId}`).emit("queue:update", queueDoc);
  io.to(`business:${businessId}`).emit("queue:updated", {
    queueId: queueDoc._id,
    businessId,
    queue: queueDoc,
  });

  // 2. Populated queue update to authorized admin/owner room
  try {
    const adminQueue = await queueDoc.constructor.findById(queueDoc._id)
      .populate("users.userId", "name email phone");
    if (adminQueue) {
      io.to(`business:${businessId}:admin`).emit("queue:update", adminQueue);
    }
  } catch {
    // Non-critical socket emission
  }
};

// GET /api/queue/:businessId
export const getQueue = asyncHandler(async (req, res) => {
  const io = req.app.get("io");
  let requesterId = null;

  const token = (req.headers.authorization && req.headers.authorization.startsWith("Bearer "))
    ? req.headers.authorization.split(" ")[1]
    : req.cookies?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      requesterId = decoded.id;
    } catch {
      // Invalid token, continue as public
    }
  }

  const queue = await queueService.getQueue(req.params.businessId, io, requesterId);
  res.json(new ApiResponse(200, { queue }));
});

// POST /api/queue/:businessId/join
export const join = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { serviceType, userType, pricingLabel, couponCode } = req.body;

  const io = req.app.get("io");
  const queue = await queueService.joinQueue(
    businessId,
    {
      userId: req.user._id,
      serviceType: serviceType || "general",
      userType: userType || "normal",
      pricingLabel,
      couponCode,
    },
    io
  );

  emitQueueUpdate(req, businessId, queue);
  if (io) {
    io.to(`business:${businessId}`).emit("queue:joined", {
      businessId,
      queueId: queue._id,
      userId: req.user._id,
      queue,
    });
  }

  res.status(200).json(new ApiResponse(200, { queue }, "Successfully joined queue"));
});

// DELETE /api/queue/:businessId/leave
export const leave = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const queue = await queueService.leaveQueue(businessId, req.user._id);
  const io = req.app.get("io");

  emitQueueUpdate(req, businessId, queue);
  if (io) {
    io.to(`business:${businessId}`).emit("queue:left", {
      businessId,
      queueId: queue._id,
      userId: req.user._id,
      queue,
    });
  }

  res.json(new ApiResponse(200, { queue }, "Left queue successfully"));
});

// POST /api/queue/:businessId/next (owner or admin only)
export const callNext = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const io = req.app.get("io");

  const queue = await queueService.callNext(
    businessId,
    req.user._id,
    req.user.role,
    io
  );

  emitQueueUpdate(req, businessId, queue);
  res.json(new ApiResponse(200, { queue }, "Called next customer"));
});

// GET /api/queue/estimate/:businessId
export const estimate = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const estimation = await queueService.estimateWaitTime(businessId, req.user._id);
  res.json(new ApiResponse(200, { estimation }, estimation.message));
});

// POST /api/queue/:businessId/extend (owner or admin only)
export const extend = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { userId, minutes } = req.body;
  const io = req.app.get("io");

  const queue = await queueService.extendTime(
    businessId,
    userId,
    minutes,
    req.user._id,
    req.user.role,
    io
  );

  emitQueueUpdate(req, businessId, queue);
  res.json(new ApiResponse(200, { queue }, `Extended service time by ${minutes} min`));
});

// POST /api/queue/:businessId/cancel-delay
export const cancelDelay = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const io = req.app.get("io");

  const { queue, totalCredited } = await queueService.handleCancelDelay(businessId, req.user._id, io);
  emitQueueUpdate(req, businessId, queue);

  res.status(200).json(
    new ApiResponse(200, { queue }, `Cancelled with ₹${totalCredited} refunded to your wallet`)
  );
});
