import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessOwnerCategory } from '../src/utils/ownerCategory.js';
import { allowRoles } from '../middleware/auth.middleware.js';
import Business from '../src/modules/business/business.model.js';
import Booking from '../src/booking/booking.model.js';

const authorize = request => new Promise(resolve => allowRoles('owner', 'admin')(request, {}, resolve));

test('owner category permissions isolate clinic and salon management', async t => {
  const clinicOwner = { _id: 'owner', role: 'owner', businessCategories: ['clinic'] };
  const salonOwner = { ...clinicOwner, businessCategories: ['salon'] };
  assert.equal(canAccessOwnerCategory(clinicOwner, { category: 'clinic' }), true);
  assert.equal(canAccessOwnerCategory(clinicOwner, { category: 'healthcare' }), true);
  assert.equal(canAccessOwnerCategory(clinicOwner, { category: 'salon' }), false);
  assert.equal(canAccessOwnerCategory(salonOwner, { category: 'clinic' }), false);
  assert.equal(canAccessOwnerCategory(salonOwner, { category: 'salon' }), true);
  assert.equal(canAccessOwnerCategory({ role: 'owner' }, { category: 'salon' }), false);
  assert.equal(canAccessOwnerCategory({ role: 'admin' }, { category: 'salon' }), true);
  assert.equal(canAccessOwnerCategory({ ...clinicOwner, businessCategories: ['clinic', 'salon'] }, { category: 'salon' }), true);
  let category = 'salon';
  t.mock.method(Business, 'findOne', async () => ({ category }));
  t.mock.method(Booking, 'findById', async () => ({ businessId: 'venue' }));
  const venueRequest = { user: clinicOwner, params: { id: 'venue' }, originalUrl: '/api/businesses/venue' };
  assert.equal((await authorize(venueRequest)).statusCode, 403);
  const bookingRequest = { user: clinicOwner, params: { id: 'booking' }, originalUrl: '/api/bookings/booking/start' };
  assert.equal((await authorize(bookingRequest)).statusCode, 403);
  category = 'clinic';
  assert.equal(await authorize(venueRequest), undefined);
  assert.match((await authorize(bookingRequest)).message, /assigned doctor/);
  assert.equal(await authorize({ ...bookingRequest, method: 'GET', originalUrl: '/api/bookings/booking/all' }), undefined);
  assert.equal(await authorize({ ...bookingRequest, method: 'PATCH', originalUrl: '/api/bookings/booking/collect-payment' }), undefined);
  const queueRequest = { user: clinicOwner, params: { businessId: 'venue' }, method: 'POST' };
  assert.equal(await authorize({ ...queueRequest, originalUrl: '/api/queue/venue/users/patient/collect-payment' }), undefined);
  for (const action of ['next', 'extend']) assert.match((await authorize({ ...queueRequest, originalUrl: `/api/queue/venue/${action}` })).message, /assigned doctor/);
  category = 'salon';
  assert.equal(await authorize({ ...bookingRequest, user: salonOwner }), undefined);
});
