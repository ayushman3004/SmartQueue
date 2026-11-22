import mongoose from 'mongoose';
import Notification from './notification.model.js';
import Queue from '../../queue/queue.model.js';
import Business from '../business/business.model.js';
import ApiError from '../../../utils/ApiError.js';

export const safeNotificationHref = value => typeof value === 'string' &&
  /^\/(?!\/)/.test(value) && !/[\\\s\u0000-\u001f]/.test(value) ? value : '';

export async function createNotification({ recipient, type, title, message, href, eventKey }, io) {
  const payload = { recipient, type, title, message, href: safeNotificationHref(href), eventKey };
  try {
    const notification = await Notification.create(payload);
    io?.to(`user:${recipient}`).emit('notification:created', notification);
    return notification;
  } catch (error) {
    if (error.code === 11000) return null; // Repeated domain events create one inbox entry.
    throw error;
  }
}

// A secondary delivery failure must not undo a successful booking or hub operation.
export async function notifyUser(payload, io) {
  if (mongoose.connection.readyState !== 1) return null;
  try {
    return await createNotification(payload, io);
  } catch (error) {
    console.error('Notification delivery failed:', error.message);
    return null;
  }
}

export function turnNotificationPayload(business, entry) {
  const recipient = entry.userId?._id || entry.userId;
  const businessId = business._id;
  const visit = entry.bookingId?._id || entry.bookingId || `${recipient}:${new Date(entry.joinedAt).getTime()}`;
  return {
    recipient, type: 'queue', title: 'It’s your turn!',
    message: `${entry.assignedStaff?.name ? `${entry.assignedStaff.name} is ready to see you` : 'You are being served now'} at ${business.name}. Please proceed to your service counter.`,
    href: `/queue/${businessId}`, eventKey: `turn:serving:${businessId}:${visit}`,
  };
}

export async function notifyServingTurns(business, entries, io) {
  await Promise.all(entries.filter(entry => entry.status === 'serving').map(entry => notifyUser(turnNotificationPayload(business, entry), io)));
}

// Recover a missed socket event or a turn that started before the inbox was opened.
async function syncCurrentTurns(recipient) {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const queues = await Queue.find({ users: { $elemMatch: { userId: recipient, status: 'serving' } } }).select('businessId users').lean();
    if (!queues.length) return;
    const businesses = await Business.find({ _id: { $in: queues.map(queue => queue.businessId) } }).select('name').lean();
    const byId = new Map(businesses.map(business => [String(business._id), business]));
    await Promise.all(queues.map(queue => {
      const business = byId.get(String(queue.businessId));
      if (!business) return;
      return notifyServingTurns(business, queue.users.filter(entry => String(entry.userId?._id || entry.userId) === String(recipient)));
    }));
  } catch (error) {
    console.error('Current turn notification sync failed:', error.message);
  }
}

export async function listNotifications(recipient, { before, unread } = {}) {
  if (before && !mongoose.isObjectIdOrHexString(before)) throw new ApiError(400, 'Invalid notification cursor.');
  if (!before) await syncCurrentTurns(recipient);
  const query = { recipient, ...(unread === 'true' ? { readAt: null } : {}) };
  if (before) query._id = { $lt: before };
  const [rows, unreadCount] = await Promise.all([
    Notification.find(query).sort({ _id: -1 }).limit(21).lean(),
    Notification.countDocuments({ recipient, readAt: null }),
  ]);
  const notifications = rows.slice(0, 20);
  return { notifications, unreadCount, nextCursor: rows.length > 20 ? String(notifications.at(-1)._id) : null };
}

export async function markNotificationRead(recipient, id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new ApiError(400, 'Invalid notification ID.');
  // Owner filtering applies even if a caller knows someone else's notification ID.
  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipient, readAt: null }, { $set: { readAt: new Date() } }, { new: true },
  );
  if (notification) return notification;
  const existing = await Notification.findOne({ _id: id, recipient });
  if (!existing) throw new ApiError(404, 'Notification not found.');
  return existing;
}

export async function markAllNotificationsRead(recipient) {
  await Notification.updateMany({ recipient, readAt: null }, { $set: { readAt: new Date() } });
}
