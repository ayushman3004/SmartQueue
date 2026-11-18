import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistoryRecords } from '../src/utils/historyRecords.js';
import { getMyBookings } from '../src/booking/booking.service.js';
import Booking from '../src/booking/booking.model.js';
import Queue from '../src/queue/queue.model.js';
import Review from '../src/modules/review/review.model.js';

test('History rows and counts follow completion and preserve review actions', () => {
  const booking = {
    _id: 'booking', status: 'serving', isLiveQueue: true,
    businessId: { _id: 'venue', name: 'Clinic', category: 'clinic' },
    startTime: '2026-11-16T09:23:00Z', paidAmount: 100,
  };
  assert.equal(buildHistoryRecords([booking])[0].status, 'serving');
  const completed = { ...booking, status: 'completed', isServing: true, review: { _id: 'review', rating: 5 } };
  const rows = buildHistoryRecords([completed]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'completed');
  assert.equal(rows[0].isServing, false);
  assert.equal(rows.filter((b) => b.status === 'completed').length, 1);
  assert.equal(rows.filter((b) => ['serving', 'waiting', 'confirmed'].includes(b.status)).length, 0);
  assert.equal(rows[0].isLiveQueue, true);
  assert.equal(rows[0].review._id, 'review');
});

test('History keeps appointment types and sorts by service date', () => {
  const bookings = [
    { _id: 'older', status: 'completed', notes: 'Direct Live Queue Entry', startTime: '2026-11-12' },
    { _id: 'newer', status: 'completed', startTime: '2026-11-18' },
  ];
  const rows = buildHistoryRecords(bookings);
  assert.deepEqual(rows.map((b) => b._id), ['newer', 'older']);
  assert.equal(rows[0].isAppointment, true);
  assert.equal(rows[1].isLiveQueue, true);
  assert.deepEqual(buildHistoryRecords(bookings, 'oldest').map((b) => b._id), ['older', 'newer']);
  assert.equal(bookings[0].isLiveQueue, undefined);
});

for (const status of ['completed', 'cancelled', 'refunded']) {
  test(`History API never turns a ${status} booking back into serving from a stale queue`, async (t) => {
    const bookingId = '507f1f77bcf86cd799439011';
    const booking = {
      _id: bookingId, status, businessId: { _id: 'venue', name: 'Clinic' }, notes: 'Direct Live Queue Entry',
    };
    t.mock.method(Booking, 'find', () => ({ populate: () => ({ sort: async () => [booking] }) }));
    t.mock.method(Queue, 'find', () => ({ populate: async () => [{
      _id: 'queue', businessId: { _id: 'venue', name: 'Clinic' },
      users: [{ userId: 'customer', bookingId, status: 'serving' }],
    }] }));
    t.mock.method(Review, 'find', async () => []);
    const records = await getMyBookings('customer');
    assert.equal(records.length, 1);
    assert.equal(records[0].status, status);
    assert.equal(buildHistoryRecords(records)[0].isServing, false);
  });
}

test('First queue position does not override an explicit waiting status in History', async (t) => {
  const bookingId = '507f1f77bcf86cd799439011';
  t.mock.method(Booking, 'find', () => ({ populate: () => ({ sort: async () => [{
    _id: bookingId, status: 'waiting', businessId: { _id: 'venue' },
  }] }) }));
  t.mock.method(Queue, 'find', () => ({ populate: async () => [{
    _id: 'queue', businessId: { _id: 'venue' },
    users: [{ userId: 'customer', bookingId, status: 'waiting' }],
  }] }));
  t.mock.method(Review, 'find', async () => []);
  const [booking] = await getMyBookings('customer');
  assert.equal(booking.status, 'waiting');
  assert.equal(booking.isServing, false);
});
