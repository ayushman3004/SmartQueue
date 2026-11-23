import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import adminRoutes from '../src/modules/admin/admin.routes.js';
import doctorRoutes from '../src/modules/doctor/doctor.routes.js';
import businessRoutes from '../src/modules/business/business.routes.js';
import User from '../src/modules/auth/auth.model.js';
import Business from '../src/modules/business/business.model.js';
import Queue from '../src/queue/queue.model.js';
import Booking from '../src/booking/booking.model.js';
import Prescription from '../src/modules/doctor/prescription.model.js';
import { getAllBusinesses } from '../src/modules/business/business.service.js';

const adminId = '111111111111111111111111';
const customerId = '222222222222222222222222';
const clinicId = '333333333333333333333333';
const staffId = '444444444444444444444444';
const bookingId = '555555555555555555555555';
const admin = { _id: adminId, role: 'admin', email: 'admin@example.test', name: 'Admin' };
const customer = { _id: customerId, role: 'customer' };
const clinic = { _id: clinicId, owner: adminId, category: 'clinic', adminTestKind: 'clinic', approvalStatus: 'approved', name: 'Test clinic', subscription: { plan: 'PRO', status: 'ACTIVE' }, staff: [{ _id: staffId, name: 'Test doctor', email: admin.email, doctorId: 'ADMIN-TEST' }] };

test('one admin session prepares Pro workspaces and handles its own assigned test consultation', async t => {
  const secret = 'test-only-super-admin-http';
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  t.after(() => { if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original; });
  const users = { [adminId]: admin, [customerId]: customer };
  t.mock.method(User, 'findById', id => ({ select: async () => users[id] }));
  t.mock.method(Business, 'findOneAndUpdate', async query => ({ ...clinic, ...query }));
  t.mock.method(Business, 'findOne', async query => query.owner === adminId && query.adminTestKind === 'clinic' ? clinic : null);
  const queue = { users: [{ userId: admin, assignedStaff: { staffId }, status: 'serving', bookingId }] };
  t.mock.method(Queue, 'findOne', () => ({ populate: async () => queue }));
  const visit = { _id: bookingId, businessId: clinicId, assignedStaff: { staffId }, status: 'serving', userId: admin };
  t.mock.method(Booking, 'find', () => ({ sort: () => ({ populate: async () => [visit] }) }));
  t.mock.method(Booking, 'findById', () => ({ populate: async () => visit }));
  t.mock.method(Prescription, 'create', async data => ({ toObject: () => ({ _id: '666666666666666666666666', ...data }) }));
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/doctors', doctorRoutes);
  app.use('/api/businesses', businessRoutes);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.on('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(id, path, body) {
    return fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${jwt.sign({ id }, secret)}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  assert.equal((await request(customerId, '/admin/workspace', {})).status, 403);
  const workspace = await request(adminId, '/admin/workspace', {});
  assert.equal(workspace.status, 200);
  assert.equal((await workspace.json()).data.user.subscription.plan, 'PRO');
  assert.equal((await request(customerId, '/doctors/dashboard')).status, 403);
  const dashboard = await request(adminId, '/doctors/dashboard');
  assert.equal(dashboard.status, 200);
  const { data } = await dashboard.json();
  assert.equal(data.clinic._id, clinicId);
  assert.equal(data.queue[0].userId._id, adminId);
  assert.equal(data.bookings[0]._id, bookingId);
  const prescription = await request(adminId, '/doctors/prescriptions', { bookingId, diagnosis: 'Test diagnosis' });
  assert.equal(prescription.status, 201);
  const record = (await prescription.json()).data.prescription;
  assert.equal(record.doctor, adminId);
  assert.equal(record.patient, adminId);
  assert.equal(record.business, clinicId);
  visit.businessId = '777777777777777777777777';
  assert.equal((await request(adminId, '/doctors/prescriptions', { bookingId, diagnosis: 'Test' })).status, 403);
});

test('customer discovery excludes test venues and administrator discovery retains their own through radius filtering', async t => {
  let pipeline;
  t.mock.method(Business, 'aggregate', async stages => { pipeline = stages; return []; });
  await getAllBusinesses();
  assert.deepEqual(pipeline[0].$match.adminTestKind, { $exists: false });
  t.mock.method(Business, 'aggregate', async stages => { pipeline = stages; return [{ ...clinic }]; });
  t.mock.method(Booking, 'find', () => ({ select: async () => [] }));
  const results = await getAllBusinesses({ testOwner: adminId, lat: 22.5, lng: 88.3, radius: 1, onlyWithinRadius: true });
  assert.equal(results.length, 1);
  assert.deepEqual(pipeline[0].$match.$and, [{ $or: [{ adminTestKind: { $exists: false } }, { owner: adminId }] }]);
});
