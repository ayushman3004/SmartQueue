import * as queueService from "./queue.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { publishQueue, queueForViewer, queueForOwner } from "./queue.view.js";
import { checkInWalkIn } from './walk-in.service.js';

// GET /api/queue/:businessId
export const getQueue = asyncHandler(async (req, res) => {
  const queue = await queueService.getQueue(req.params.businessId, req.app.get("io"), req.user);
  res.json(new ApiResponse(200, { queue }));
});

// POST /api/queue/:businessId/join
export const join = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { serviceType, userType, pricingLabel, couponCode, services, preferredStaff } = req.body;

  const io = req.app.get("io");
  const queue = await queueService.joinQueue(
    businessId,
    {
      userId: req.user._id,
      serviceType: serviceType || "general",
      userType: userType || "normal",
      pricingLabel,
      couponCode,
      services,
      preferredStaff,
    },
    io
  );

  publishQueue(io, businessId, queue);
  io?.to(`user:${req.user._id}`).emit("queue:joined", { businessId, userId: req.user._id });
  res.status(200).json(new ApiResponse(200, { queue: queueForViewer(queue, req.user._id) }, "Successfully joined queue"));
});

// DELETE /api/queue/:businessId/leave
export const leave = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const io = req.app.get("io");
  const queue = await queueService.leaveQueue(businessId, req.user._id, io);

  publishQueue(io, businessId, queue);
  io?.to(`user:${req.user._id}`).emit("queue:left", { businessId, userId: req.user._id });
  res.json(new ApiResponse(200, { queue: queueForViewer(queue, req.user._id) }, "Left queue successfully"));
});

export const walkIn = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { queue, booking } = await checkInWalkIn(businessId, req.user, req.body);
  const io = req.app.get('io');
  publishQueue(io, businessId, queue);
  io?.to(`user:${booking.userId}`).emit('queue:joined', { businessId, userId: booking.userId });
  io?.to(`user:${booking.userId}`).emit('booking:confirmed', { booking: { _id: booking._id, businessId } });
  const position = queue.users.findIndex(row => String(row.bookingId) === String(booking._id)) + 1;
  res.status(201).json(new ApiResponse(201, { position }, 'Patient added to the queue.'));
});

// POST /api/queue/:businessId/next (owner or admin only)
export const callNext = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { staffName, userId } = req.body || req.query || {};
  const io = req.app.get("io");

  const queue = await queueService.callNext(
    businessId,
    req.user._id,
    req.user.role,
    io,
    staffName,
    userId
  );

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

  res.json(new ApiResponse(200, { queue }, `Extended service time by ${minutes} min`));
});

// POST /api/queue/:businessId/cancel-delay
export const cancelDelay = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const io = req.app.get("io");

  const { queue } = await queueService.handleCancelDelay(businessId, req.user._id, io);
  publishQueue(io, businessId, queue);

  res.status(200).json(
    new ApiResponse(200, { queue: queueForViewer(queue, req.user._id) }, "Successfully removed from queue")
  );
});

// POST /api/queue/:businessId/assign-staff (owner or admin only)
export const assignStaff = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { userId, staffName } = req.body;
  const io = req.app.get("io");

  const queue = await queueService.assignStaff(
    businessId,
    userId,
    staffName,
    req.user._id,
    req.user.role,
    io
  );

  res.json(new ApiResponse(200, { queue }, "Assigned staff member successfully"));
});

// POST /api/queue/:businessId/users/:userId/collect-payment (owner or admin only)
export const collectPayment = asyncHandler(async (req, res) => {
  const { businessId, userId } = req.params;
  const io = req.app.get("io");

  const queue = await queueService.collectQueuePayment(
    businessId,
    userId,
    req.user,
    io
  );

  res.json(new ApiResponse(200, { queue: req.user.role === 'owner' ? queueForOwner(queue) : queue }, "Counter payment recorded and verified as paid"));
});

