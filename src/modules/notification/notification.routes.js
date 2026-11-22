import { Router } from 'express';
import { protect } from '../../../middleware/auth.middleware.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from './notification.service.js';

const router = Router();
router.use(protect);
router.get('/', asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, await listNotifications(req.user._id, req.query)));
}));
router.patch('/read-all', asyncHandler(async (req, res) => {
  await markAllNotificationsRead(req.user._id);
  req.app.get('io')?.to(`user:${req.user._id}`).emit('notification:read');
  res.json(new ApiResponse(200, {}, 'All notifications marked as read'));
}));
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const notification = await markNotificationRead(req.user._id, req.params.id);
  req.app.get('io')?.to(`user:${req.user._id}`).emit('notification:read');
  res.json(new ApiResponse(200, { notification }));
}));
export default router;
