import test from 'node:test';
import assert from 'node:assert/strict';
import {
  customerServicePath, filterServiceVenues, filterServiceBookings,
  matchesCustomerService, normalizeServiceCategory,
} from '../src/utils/customerService.js';

const venues = [
  { _id: 'salon', name: 'Bh-9 Salon', category: 'salon' },
  { _id: 'clinic', name: 'Jalandhar Clinic', category: 'clinic' },
  { _id: 'barber', category: 'barbershop' },
  { _id: 'health', category: 'healthcare' },
  { _id: 'beauty', category: 'beauty' },
  { _id: 'doctor', category: 'doctor' },
  { _id: 'unknown' },
];

test('clinic discovery excludes legacy categories', () => {
  const clinics = filterServiceVenues(venues, 'clinic');
  const salons = filterServiceVenues(venues, 'salon');
  assert.deepEqual(clinics.map(v => v._id), ['clinic', 'health', 'doctor']);
  assert.deepEqual(salons, []);
  assert.equal(clinics[0].name, 'Jalandhar Clinic', 'never fall back to the first salon in a mixed response');
  assert.deepEqual(clinics.filter(v => v.name?.includes('Salon')), []);
  assert.deepEqual(filterServiceVenues(venues, null), [], 'wait for a service choice before showing venues');
  assert.deepEqual(filterServiceVenues(venues, 'invalid'), []);
  assert.deepEqual(filterServiceVenues([venues[0]], 'clinic'), [], 'an empty clinic list must not fall back to salons');
  assert.equal(matchesCustomerService(venues[0], 'clinic'), false, 'cross-service deep links must not load booking details');
});

test('clinic service routes replace legacy category parameters', () => {
  assert.equal(normalizeServiceCategory(' Healthcare '), 'clinic');
  assert.equal(customerServicePath('/booking/clinic?date=2026-11-20#slots', 'clinic'), '/booking/clinic?date=2026-11-20&category=clinic#slots');
  assert.equal(customerServicePath('/customers?category=salon', 'clinic'), '/customers?category=clinic');
  assert.equal(customerServicePath('/queue', 'clinic'), '/queue?category=clinic');
  assert.equal(customerServicePath('/history', 'salon'), '/history');
  assert.equal(customerServicePath('/profile', 'salon'), '/profile');
});

test('history, queue badges and appointment lists exclude bookings from the other service', () => {
  const bookings = [
    { _id: 1, businessId: venues[0] }, { _id: 2, businessId: venues[1] },
    { _id: 3, businessId: 'health' }, { _id: 4, businessId: { _id: 'barber' } },
    { _id: 5, businessId: 'missing' },
  ];
  assert.deepEqual(filterServiceBookings(bookings, venues, 'clinic').map(b => b._id), [2, 3]);
  assert.deepEqual(filterServiceBookings(bookings, venues, 'salon'), []);
});

test('discovery API restricts each service to its supported category aliases', async (t) => {
  const { default: Business } = await import('../src/modules/business/business.model.js');
  const { getAllBusinesses } = await import('../src/modules/business/business.service.js');
  let match;
  t.mock.method(Business, 'aggregate', async pipeline => { match = pipeline[0].$match; return []; });
  for (const category of [undefined, 'all', 'clinic', 'healthcare', 'doctor']) {
    await getAllBusinesses({ category, includeAll: false });
    assert.deepEqual(match.category, { $in: ['clinic', 'healthcare', 'doctor'] });
    assert.equal(match.isActive, true);
  }
  for (const category of ['salon', 'barbershop', 'beauty']) {
    match = null;
    assert.deepEqual(await getAllBusinesses({ category }), []);
    assert.equal(match, null);
  }
});

test('legacy venue IDs cannot open clinic queues or create appointments', async t => {
  const { default: Business } = await import('../src/modules/business/business.model.js');
  const { createBooking, getAvailableSlots } = await import('../src/booking/booking.service.js');
  const { getQueue } = await import('../src/queue/queue.service.js');
  t.mock.method(Business, 'findById', async () => venues[0]);

  await assert.rejects(getQueue('salon'), { statusCode: 404 });
  await assert.rejects(getAvailableSlots('salon', '2026-12-01'), { statusCode: 404 });
  await assert.rejects(createBooking({ businessId: 'salon', userId: 'patient' }), { statusCode: 404 });
});
