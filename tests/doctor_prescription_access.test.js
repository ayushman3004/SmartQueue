import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import doctorRoutes from '../src/modules/doctor/doctor.routes.js';
import User from '../src/modules/auth/auth.model.js';
import Business from '../src/modules/business/business.model.js';
import Queue from '../src/queue/queue.model.js';
import Booking from '../src/booking/booking.model.js';
import Prescription from '../src/modules/doctor/prescription.model.js';
import { requireAssigned } from '../src/modules/doctor/doctor-access.js';

const clinicId = '111111111111111111111111';
const doctorId = '222222222222222222222222';
const otherDoctorId = '333333333333333333333333';
const patientId = '444444444444444444444444';
const bookingId = '555555555555555555555555';
const rxId = '666666666666666666666666';
const staff = { _id: '777777777777777777777777', name: 'Dr. Demo', email: 'doctor@example.test', doctorId: 'DEMO-10' };
const clinic = { subscription: { status: 'ACTIVE', plan: 'BASIC' }, _id: clinicId, owner: 'owner', name: 'Demo Clinic', category: 'clinic', approvalStatus: 'approved', staff: [staff] };
const doctor = { _id: doctorId, role: 'doctor', email: staff.email, doctorAccess: { businessId: clinicId, staffId: staff._id, doctorId: staff.doctorId, status: 'ACTIVE' } };
const patient = { _id: patientId, role: 'customer', name: 'Demo Patient' };
const visit = { _id: bookingId, businessId: clinicId, userId: patient, status: 'serving', assignedStaff: { staffId: staff._id, name: staff.name } };

test('a stable staff ID takes precedence over a reused name, and ambiguous old assignments are rejected', () => {
  const context = { business: clinic, staff };
  assert.doesNotThrow(() => requireAssigned(visit, context));
  assert.throws(() => requireAssigned({ ...visit, assignedStaff: { staffId: otherDoctorId, name: staff.name } }, context), /not assigned/);
  assert.throws(() => requireAssigned({ createdAt: new Date('2050-01-01'), assignedStaff: { name: staff.name } }, { staff, business: { ...clinic, staff: [staff, { ...staff, _id: otherDoctorId }] } }), /not assigned/);
});

test('prescriptions are saved for the assigned patient and readable only by that patient and doctor', async t => {
  const secret = 'test-only-doctor-routes';
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  t.after(() => { if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original; });
  const users = {
    [doctorId]: doctor, [patientId]: patient,
    stranger: { _id: 'stranger', role: 'customer' },
    owner: { _id: 'owner', role: 'owner' },
    admin: { _id: 'admin', role: 'admin' },
  };
  t.mock.method(User, 'findById', id => ({ select: async () => users[id] }));
  t.mock.method(Business, 'findById', async () => clinic);
  const queue = {
    users: [
      { userId: patientId, status: 'serving', serviceTime: 15, assignedStaff: visit.assignedStaff },
      { userId: otherDoctorId, status: 'serving', serviceTime: 25, assignedStaff: { staffId: otherDoctorId, name: 'Dr. Other' } },
    ],
    save: async () => {},
  };
  t.mock.method(Queue, 'findOne', async () => queue);
  let activeVisit = visit;
  t.mock.method(Booking, 'findById', () => ({ populate: async () => activeVisit }));
  let saved;
  t.mock.method(Prescription, 'create', async data => { saved = { ...data, _id: rxId, createdAt: new Date() }; return saved; });
  function matches(filter) { return saved && (!filter.patient || filter.patient === saved.patient) && (!filter.doctor || filter.doctor === saved.doctor); }
  t.mock.method(Prescription, 'find', filter => ({ sort: () => ({ select: async () => matches(filter) ? [saved] : [] }) }));
  t.mock.method(Prescription, 'findOne', async filter => matches(filter) ? saved : null);
  const app = express();
  app.use(express.json());
  app.use('/api/doctors', doctorRoutes);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = await new Promise((resolve, reject) => {
    const value = app.listen(0, '127.0.0.1', () => resolve(value));
    value.on('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (role, path, body) => fetch(`http://127.0.0.1:${server.address().port}/api/doctors${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${jwt.sign({ id: role }, secret)}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await request(doctorId, `/queue/${otherDoctorId}/extend`, { minutes: 5 })).status, 403);
  assert.equal((await request(doctorId, `/queue/${patientId}/extend`, { minutes: 5 })).status, 200);
  assert.deepEqual(queue.users.map(entry => entry.serviceTime), [20, 25]);
  const input = { bookingId, diagnosis: 'Synthetic diagnosis for testing', advice: 'Synthetic advice', patient: 'stranger', doctor: otherDoctorId };
  activeVisit = { ...visit, assignedStaff: { staffId: otherDoctorId, name: staff.name } };
  assert.equal((await request(doctorId, '/prescriptions', input)).status, 403);
  activeVisit = visit;
  assert.equal((await request(doctorId, '/prescriptions', input)).status, 201);
  assert.equal(saved.patient, patientId);
  assert.equal(saved.doctor, doctorId);
  assert.equal((await (await request(patientId, '/prescriptions')).json()).data.prescriptions.length, 1);
  assert.equal((await (await request('stranger', '/prescriptions')).json()).data.prescriptions.length, 0);
  const path = `/prescriptions/${rxId}/pdf`;
  assert.equal((await request('stranger', path)).status, 404);
  assert.equal((await request('owner', path)).status, 403);
  assert.equal((await request('admin', path)).status, 403);
  const pdf = await request(patientId, path);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('cache-control'), 'private, no-store');
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  assert.equal((await request(doctorId, path)).status, 200);
});
