import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveSubscription } from '../src/utils/subscription.js';
import { ensureAdminWorkspace, assertTestVenueAccess } from '../src/modules/admin/admin-workspace.service.js';
import { doctorContext, prescriptionFilter } from '../src/modules/doctor/doctor-access.js';
import { getCurrentSubscription, createSubscriptionOrder } from '../src/modules/subscription/subscription.service.js';
import { sanitize, login } from '../src/modules/auth/auth.service.js';
import { hashPassword } from '../src/modules/auth.utils.js';
import Business from '../src/modules/business/business.model.js';
import User from '../src/modules/auth/auth.model.js';

const admin = { _id: '111111111111111111111111', role: 'admin', email: 'admin@example.test', name: 'Administrator', subscription: { plan: 'NONE', status: 'INACTIVE' } };

test('admin has perpetual Pro in profile and subscription API, without altering paid owner plans', async t => {
  assert.deepEqual(sanitize(admin).subscription, effectiveSubscription(admin));
  assert.equal(sanitize(admin).role, 'admin');
  const owner = { ...admin, role: 'owner', subscription: { plan: 'BASIC', status: 'EXPIRED' } };
  assert.deepEqual(effectiveSubscription(owner), owner.subscription);
  t.mock.method(User, 'findById', async () => admin);
  const result = await getCurrentSubscription(admin._id);
  assert.equal(result.subscription.status, 'ACTIVE');
  assert.equal(result.subscription.expiresAt, null);
  assert.equal(result.currentPlan.id, 'PRO');
  await assert.rejects(createSubscriptionOrder(admin._id, 'PRO'), /No payment is required/);
});

test('workspace preparation is reusable, creates no user accounts, and rejects non-admins', async t => {
  const venues = new Map();
  t.mock.method(Business, 'findOneAndUpdate', async (query, update, options) => {
    assert.equal(options.upsert, true);
    const key = `${query.owner}:${query.adminTestKind}`;
    if (!venues.has(key)) {
      const venue = new Business({ ...update.$setOnInsert, onboarding: { status: update.$setOnInsert['onboarding.status'] } });
      await venue.validate();
      venues.set(key, venue);
    }
    return venues.get(key);
  });
  t.mock.method(User, 'create', () => { throw new Error('Must not create another account'); });
  const first = await ensureAdminWorkspace(admin);
  const second = await ensureAdminWorkspace(admin);
  assert.equal(venues.size, 2);
  assert.equal(first.clinic, second.clinic);
  assert.equal(first.salon, second.salon);
  assert.equal(first.clinic.subscription.plan, 'PRO');
  assert.equal(first.clinic.staff[0].email, admin.email);
  assert.equal(first.clinic.staff[0].doctorId, 'ADMIN-TEST');
  assert.equal(first.salon.services[0].price, 0);
  await assert.rejects(ensureAdminWorkspace({ ...admin, role: 'customer' }), /Super admin/);
});

test('test venues accept only their owning administrator identity', () => {
  const venue = { owner: admin._id, adminTestKind: 'clinic' };
  assert.doesNotThrow(() => assertTestVenueAccess(venue, admin._id));
  assert.throws(() => assertTestVenueAccess(venue, 'different-account'), /Business not found/);
  assert.throws(() => assertTestVenueAccess(venue), /Business not found/);
  assert.doesNotThrow(() => assertTestVenueAccess({ owner: admin._id }, 'customer'));
});

test('admin doctor access is scoped to the owned test clinic and prescriptions to their own identity', async t => {
  const staff = { _id: '222222222222222222222222', email: admin.email, doctorId: 'ADMIN-TEST' };
  const clinic = { _id: '333333333333333333333333', staff: [staff] };
  t.mock.method(Business, 'findOne', async query => {
    assert.deepEqual(query, { owner: admin._id, adminTestKind: 'clinic', category: 'clinic', approvalStatus: 'approved' });
    return clinic;
  });
  assert.equal((await doctorContext(admin)).staff, staff);
  assert.deepEqual(prescriptionFilter(admin), { $or: [{ doctor: admin._id }, { patient: admin._id }] });
  t.mock.method(Business, 'findOne', async () => null);
  await assert.rejects(doctorContext(admin), /prepare your test clinic/);
  await assert.rejects(doctorContext({ ...admin, role: 'customer' }), /Doctor access is disabled/);
});

test('same administrator credentials can sign in through every dashboard gateway', async t => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'admin-workspace-test-secret';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const password = 'TestAdminPass123!';
  const passwordHash = await hashPassword(password);
  t.mock.method(User, 'findOne', () => ({ select: async () => ({ ...admin, password: passwordHash }) }));
  for (const requiredRole of ['admin', 'owner', 'doctor', 'customer']) {
    const result = await login({ email: admin.email, password, requiredRole });
    assert.equal(result.user.role, 'admin');
    assert.equal(result.user.subscription.plan, 'PRO');
    assert.ok(result.token);
  }
});
