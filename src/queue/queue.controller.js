import * as queueService from "./queue.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";

const emitQueueUpdate = (req, businessId, queueDoc) => {
  const io = req.app.get("io");
  if (io) {
    io.to(`business:${businessId}`).emit("queue:update", queueDoc);
  }
};

// GET /api/queue/:businessId
export const getQueue = asyncHandler(async (req, res) => {
  const io = req.app.get("io");
  const queue = await queueService.getQueue(req.params.businessId, io);
  res.json(new ApiResponse(200, { queue }));
});

// POST /api/queue/:businessId/join
export const join = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { serviceType, userType } = req.body;

  const queue = await queueService.joinQueue(businessId, {
    userId: req.user._id,
    serviceType: serviceType || "general",
    userType: userType || "normal",
  });

  emitQueueUpdate(req, businessId, queue);
  res.status(200).json(new ApiResponse(200, { queue }, "Joined queue"));
});

// DELETE /api/queue/:businessId/leave
export const leave = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const queue = await queueService.leaveQueue(businessId, req.user._id);
  emitQueueUpdate(req, businessId, queue);
  res.json(new ApiResponse(200, { queue }, "Left queue"));
});

// POST /api/queue/:businessId/next  (owner only)
export const callNext = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const io = req.app.get("io");
  const queue = await queueService.callNext(businessId, io);
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
  res.json(new ApiResponse(200, { queue }, "Extended service time"));
});
