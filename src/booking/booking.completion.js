import Booking from './booking.model.js';
import Queue from '../queue/queue.model.js';
import { callNext } from '../queue/queue.service.js';
import { completeExpiredBooking } from './booking.service.js';

export const completeOverdueBookings = async (io, now = new Date()) => {
  // Queue ETA is authoritative: waiting bookings can have an old endTime from when they joined.
  const queues = await Queue.find({ 'users.0': { $exists: true } });
  for (const queue of queues) {
    const isDue = (user) => {
      if (user.status !== 'serving' || user.walkIn) return false;
      const start = user.estimatedStartTime || user.joinedAt;
      const finish = new Date(start).getTime() + Math.max(1, Number(user.serviceTime) || 15) * 60000;
      return Number.isFinite(finish) && finish <= now.getTime();
    };
    if (!queue.users.some(isDue)) continue;
    // A short database lease serializes background queue advancement across server instances.
    const leaseUntil = new Date(Date.now() + 60000);
    const lockedQueue = await Queue.findOneAndUpdate({
      _id: queue._id,
      $or: [{ autoCompletionLeaseUntil: null }, { autoCompletionLeaseUntil: { $lte: new Date() } }],
    }, { $set: { autoCompletionLeaseUntil: leaseUntil } }, { new: true });
    if (!lockedQueue) continue;
    try {
      for (const user of lockedQueue.users.filter(isDue)) {
        await callNext(lockedQueue.businessId, null, 'admin', io, null, user.userId, now);
      }
    } catch (error) {
      console.error('Automatic queue completion failed:', queue.businessId, error.message);
    } finally {
      await Queue.updateOne({ _id: queue._id, autoCompletionLeaseUntil: leaseUntil }, {
        $set: { autoCompletionLeaseUntil: null },
      });
    }
  }

  const dueBookings = await Booking.find({
    walkIn: { $ne: true },
    status: { $in: ['confirmed', 'scheduled', 'delayed', 'serving', 'in-progress', 'waiting'] },
    endTime: { $lte: now },
  });
  for (const candidate of dueBookings) {
    try {
      // Recheck live membership after advancing queues; never complete someone still waiting/serving there.
      const queued = await Queue.exists({
        businessId: candidate.businessId,
        users: { $elemMatch: { userId: candidate.userId, status: { $in: ['waiting', 'serving'] } } },
      });
      if (queued) continue;
      const booking = await completeExpiredBooking(candidate._id, now);
      if (!booking) continue;
      if (io) {
        const payload = { businessId: booking.businessId, bookingId: booking._id, booking };
        for (const room of [`business:${booking.businessId}`, `business:${booking.businessId}:admin`, `user:${booking.userId}`]) {
          io.to(room).emit('service:completed', room.endsWith(':admin') || room.startsWith('user:') ? payload : { businessId: booking.businessId });
          io.to(room).emit('bookings:updated');
        }
      }
    } catch (error) {
      console.error('Automatic booking completion failed:', candidate._id, error.message);
    }
  }
};

export const startBookingCompletionWorker = (io, intervalMs = 5000) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await completeOverdueBookings(io);
    } catch (error) {
      console.error('Booking completion worker failed:', error.message);
    } finally {
      running = false;
    }
  };
  // Also catch up overdue bookings after a server restart, without relying on connected sockets.
  void tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
};
