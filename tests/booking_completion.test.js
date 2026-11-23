import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import Booking from '../src/booking/booking.model.js';
import Queue from '../src/queue/queue.model.js';
import Business from '../src/modules/business/business.model.js';
import { completeOverdueBookings, startBookingCompletionWorker } from '../src/booking/booking.completion.js';
import { completeExpiredBooking } from '../src/booking/booking.service.js';
import { callNext } from '../src/queue/queue.service.js';

const now = new Date('2026-11-18T10:00:00Z');
const minutesAgo = (mins) => new Date(now.getTime() - mins * 60000);
const socket = () => {
  const events = [];
  return { events, to: (room) => ({ emit: (name, payload) => events.push({ room, name, payload }) }) };
};

test('Overdue appointments complete without connected clients, persist, and broadcast once', async (t) => {
  const booking = {
    _id: 'booking', businessId: 'venue', userId: 'customer', status: 'serving',
    endTime: minutesAgo(1), assignedStaff: { name: 'Doctor' },
    services: [{ price: 100 }], paidAmount: 0, paymentStatus: 'pending', save: async () => {},
  };
  const business = { staff: [{ name: 'Doctor', customersServed: 0 }], save: async () => {} };
  t.mock.method(Queue, 'find', async () => []);
  t.mock.method(Queue, 'exists', async () => null);
  t.mock.method(Queue, 'findOne', async () => null);
  t.mock.method(Business, 'findById', async () => business);
  t.mock.method(Booking, 'find', async () => booking.status === 'completed' ? [] : [booking]);
  t.mock.method(Booking, 'findOneAndUpdate', async (query) => {
    assert.ok(query.status.$in.includes(booking.status));
    assert.equal(query.endTime.$lte, now);
    booking.status = 'completed';
    return booking;
  });
  const io = socket();
  await completeOverdueBookings(io, now);
  await completeOverdueBookings(io, now);
  assert.equal(booking.status, 'completed');
  assert.equal(booking.paidAmount, 100);
  assert.equal(booking.paymentStatus, 'pending');
  assert.equal(business.staff[0].customersServed, 1);
  assert.equal(io.events.filter((e) => e.name === 'service:completed').length, 3);
  assert.ok(io.events.some((e) => e.room === 'user:customer' && e.name === 'bookings:updated'));
});

test('Queue completion follows shown finish ETA, advances the next customer, and respects other staff extensions', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
  const queue = {
    _id: 'queue', businessId: 'venue', save: async () => {},
    users: [
      { userId: 'first', bookingId: 'b1', status: 'serving', serviceTime: 10, estimatedStartTime: minutesAgo(10), assignedStaff: { name: 'A' } },
      { userId: 'second', bookingId: 'b2', status: 'waiting', serviceTime: 10, estimatedStartTime: minutesAgo(1), assignedStaff: { name: 'A' } },
      { userId: 'third', bookingId: 'b3', status: 'waiting', serviceTime: 10, estimatedStartTime: minutesAgo(1), assignedStaff: { name: 'A' } },
      { userId: 'extended', bookingId: 'b4', status: 'serving', serviceTime: 30, estimatedStartTime: minutesAgo(20), assignedStaff: { name: 'B' } },
    ],
  };
  const records = Object.fromEntries(queue.users.map((u) => [u.bookingId, {
    _id: u.bookingId, businessId: 'venue', userId: u.userId, status: u.status,
    startTime: minutesAgo(30), endTime: minutesAgo(1), paidAmount: 100,
  }]));
  const business = { name: 'Clinic', category: 'clinic', staff: [{ name: 'A', customersServed: 0 }], save: async () => {} };
  t.mock.method(Queue, 'find', async () => [queue]);
  t.mock.method(Queue, 'findOneAndUpdate', async () => queue);
  t.mock.method(Queue, 'updateOne', async () => ({}));
  t.mock.method(Queue, 'findOne', async () => queue);
  t.mock.method(Queue, 'exists', async (query) => queue.users.some((u) => u.userId === query.users.$elemMatch.userId));
  t.mock.method(Business, 'findById', async () => business);
  t.mock.method(Booking, 'findById', async (id) => records[id]);
  t.mock.method(Booking, 'findOneAndUpdate', async (query, update) => {
    Object.assign(records[query._id], update.$set);
    return records[query._id];
  });
  t.mock.method(Booking, 'findByIdAndUpdate', async (id, update) => Object.assign(records[id], update));
  t.mock.method(Booking, 'find', async () => Object.values(records).filter((b) => b.status !== 'completed' && b.endTime <= now));
  const io = socket();
  await completeOverdueBookings(io, now);
  assert.equal(records.b1.status, 'completed');
  assert.deepEqual(queue.users.map((u) => u.userId), ['second', 'third', 'extended']);
  assert.equal(queue.users[0].status, 'serving');
  assert.equal(queue.users[0].estimatedStartTime.getTime(), now.getTime());
  assert.equal(records.b2.endTime.getTime(), now.getTime() + 10 * 60000);
  assert.equal(records.b3.status, 'waiting');
  assert.equal(records.b4.status, 'serving');
  assert.equal(business.staff[0].customersServed, 1);
  await completeOverdueBookings(io, now);
  assert.equal(business.staff[0].customersServed, 1);
  assert.ok(io.events.some((e) => e.room === 'user:first' && e.name === 'service:completed'));
  assert.ok(io.events.some((e) => e.name === 'queue:update'));
  assert.ok(io.events.some((e) => e.room === 'business:venue:admin' && e.name === 'bookings:updated'));
  assert.ok(io.events.some((e) => e.room === 'user:second' && e.name === 'bookings:updated'));
});

test('A live ETA extension or removed customer prevents stale automatic completion', async (t) => {
  const queue = { users: [{ userId: 'customer', status: 'serving', estimatedStartTime: minutesAgo(10), serviceTime: 20 }] };
  t.mock.method(Business, 'findById', async () => ({ category: 'clinic' }));
  t.mock.method(Queue, 'findOne', async () => queue);
  const query = t.mock.method(Booking, 'findOne', () => { throw new Error('Must not complete'); });
  assert.equal(await callNext('venue', null, 'admin', null, null, 'customer', now), queue);
  assert.equal(await callNext('venue', null, 'admin', null, null, 'removed-customer', now), queue);
  assert.equal(query.mock.callCount(), 0);
});

test('An expired booking claim cannot complete cancelled, refunded, future, or already completed bookings', async (t) => {
  t.mock.method(Booking, 'findOneAndUpdate', async (query) => {
    for (const status of ['cancelled', 'refunded', 'completed', 'pending_payment']) {
      assert.ok(!query.status.$in.includes(status));
    }
    assert.equal(query.endTime.$lte, now);
    return null;
  });
  assert.equal(await completeExpiredBooking('booking', now), null);
});

test('Worker starts immediately, avoids overlapping scans, repeats, and can stop', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let release;
  const scan = t.mock.method(Queue, 'find', () => new Promise((resolve) => { release = resolve; }));
  t.mock.method(Booking, 'find', async () => []);
  const stop = startBookingCompletionWorker(null);
  assert.equal(scan.mock.callCount(), 1);
  t.mock.timers.tick(15000);
  assert.equal(scan.mock.callCount(), 1);
  release([]);
  await setImmediate();
  t.mock.timers.tick(5000);
  assert.equal(scan.mock.callCount(), 2);
  stop();
  release([]);
  await setImmediate();
  t.mock.timers.tick(10000);
  assert.equal(scan.mock.callCount(), 2);
});
