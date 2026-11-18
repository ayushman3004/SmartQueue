import test from 'node:test';
import assert from 'node:assert/strict';
import { getBookingDateRange, getBookingDateError, getBusinessDate } from '../src/utils/bookingDates.js';
import Business from '../src/modules/business/business.model.js';
import Booking from '../src/booking/booking.model.js';
import { getAvailableSlots, createBooking } from '../src/booking/booking.service.js';

const now = new Date('2026-11-18T04:25:00Z');
const venue = {
  operatingHours: { timezone: 'Asia/Kolkata' },
  bookingSettings: { maxAdvanceBookingDays: 7 },
  subscription: { status: 'ACTIVE', plan: 'PRO' },
};

test('Booking range uses each venue’s configured calendar days inclusively', () => {
  assert.deepEqual(getBookingDateRange(venue, now), {
    today: '2026-11-18', minDate: '2026-11-18', maxDate: '2026-11-25', maxAdvanceDays: 7,
  });
  assert.equal(getBookingDateError('2026-11-25', venue, now), null);
  assert.match(getBookingDateError('2026-11-26', venue, now), /more than 7 days/);
  assert.match(getBookingDateError('2026-11-17', venue, now), /past/);
  assert.equal(getBookingDateRange({}, now).maxDate, '2026-12-02');
  assert.equal(getBookingDateRange({ bookingSettings: { maxAdvanceBookingDays: 1 } }, now).maxDate, '2026-11-19');
  assert.equal(getBookingDateRange({ bookingSettings: { maxAdvanceBookingDays: 90 } }, now).maxDate, '2027-02-16');
});

test('Same-day policy and dates follow the business timezone near midnight', () => {
  const midnight = new Date('2026-11-18T19:00:00Z');
  const noSameDay = { ...venue, bookingSettings: { ...venue.bookingSettings, allowSameDayBooking: false } };
  assert.equal(getBusinessDate(midnight, venue), '2026-11-19');
  assert.equal(getBookingDateRange(noSameDay, midnight).minDate, '2026-11-20');
  assert.match(getBookingDateError('2026-11-19', noSameDay, midnight), /Same-day/);
  assert.equal(getBookingDateError('2026-11-20', noSameDay, midnight), null);
  const westCoast = { operatingHours: { timezone: 'America/Los_Angeles' } };
  assert.equal(getBusinessDate('2026-11-18T04:25:00Z', westCoast), '2026-11-17');
});

test('Invalid dates and disabled appointments are rejected', () => {
  for (const date of ['', null, 'garbage', '2026-11-31', '2026-11-19T10:00:00Z']) {
    assert.equal(getBookingDateError(date, venue, now), 'Invalid booking date');
  }
  assert.match(getBookingDateError('2026-11-19', { bookingSettings: { enableAppointments: false } }, now), /disabled/);
});

test('Slots and booking APIs enforce the same window before querying bookings', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
  const business = structuredClone(venue);
  t.mock.method(Business, 'findById', async () => business);
  const query = t.mock.method(Booking, 'find', () => { throw new Error('Unexpected booking query'); });
  const write = t.mock.method(Booking, 'create', () => { throw new Error('Unexpected booking write'); });
  for (const date of ['2026-11-17', '2026-11-26', 'invalid', '2026-11-31']) {
    await assert.rejects(getAvailableSlots('venue', date), { statusCode: 400 });
  }
  for (const startTime of ['2026-11-26T10:00:00+05:30', '2026-11-18T09:00:00+05:30', 'invalid']) {
    await assert.rejects(createBooking({ businessId: 'venue', userId: 'user', startTime }), { statusCode: 400 });
  }
  business.bookingSettings.allowSameDayBooking = false;
  await assert.rejects(getAvailableSlots('venue', '2026-11-18'), /Same-day/);
  await assert.rejects(createBooking({ businessId: 'venue', startTime: '2026-11-18T15:00:00+05:30' }), /Same-day/);
  business.bookingSettings.enableAppointments = false;
  await assert.rejects(getAvailableSlots('venue', '2026-11-19'), { statusCode: 403 });
  await assert.rejects(createBooking({ businessId: 'venue', startTime: '2026-11-19T15:00:00+05:30' }), { statusCode: 403 });
  assert.equal(query.mock.callCount(), 0);
  assert.equal(write.mock.callCount(), 0);
});

test('Slots remain available and bookings succeed through the entire last allowed day', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
  t.mock.method(Business, 'findById', async () => venue);
  t.mock.method(Booking, 'find', () => Object.assign(Promise.resolve([]), { sort: async () => [] }));
  const result = await getAvailableSlots('venue', '2026-11-25');
  assert.ok(result.slots.length > 0);
  t.mock.method(Booking, 'findOne', async () => null);
  t.mock.method(Booking, 'countDocuments', async () => 0);
  t.mock.method(Booking, 'create', async (data) => ({ ...data, populate: async () => data }));
  const startTime = '2026-11-25T17:00:00+05:30';
  const created = await createBooking({ businessId: 'venue', userId: 'user', startTime });
  assert.equal(created.booking.startTime.toISOString(), new Date(startTime).toISOString());
});
