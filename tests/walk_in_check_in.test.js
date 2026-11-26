import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import Booking from '../src/booking/booking.model.js';
import { cancelBooking } from '../src/booking/booking.service.js';
import User from '../src/modules/auth/auth.model.js';
import { sanitize } from '../src/modules/auth/auth.service.js';
import { createPhoneVerification } from '../src/modules/auth/phone-verification.service.js';
import Business from '../src/modules/business/business.model.js';
import Prescription from '../src/modules/doctor/prescription.model.js';
import Delivery from '../src/modules/whatsapp/whatsapp-delivery.model.js';
import { dispatchPrescription, schedulePrescriptionNotification } from '../src/modules/whatsapp/prescription-notifications.js';
import Queue from '../src/queue/queue.model.js';
import { getQueue, startWalkInVisit, callNext } from '../src/queue/queue.service.js';
import { checkInWalkIn } from '../src/queue/walk-in.service.js';

const mongo = process.env.WALK_IN_TEST_MONGO_URL;
test('walk-ins share the live queue, keep private records on the same account, and can sign in with WhatsApp', { skip: !mongo }, async t => {
  await mongoose.connect(mongo, { dbName: `walk_in_test_${randomBytes(8).toString('hex')}` });
  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const previousKey = process.env.PRESCRIPTION_ENCRYPTION_KEY;
  process.env.PRESCRIPTION_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  t.after(() => {
    if (previousKey === undefined) delete process.env.PRESCRIPTION_ENCRYPTION_KEY;
    else process.env.PRESCRIPTION_ENCRYPTION_KEY = previousKey;
  });
  await Promise.all([User.init(), Business.init(), Booking.init(), Queue.init(), Prescription.init(), Delivery.init()]);

  const owner = await User.create({ name: 'Clinic owner', email: 'owner@example.test', role: 'owner', businessCategories: ['clinic'] });
  const clinic = await Business.create({ name: 'Test clinic', category: 'clinic', owner: owner._id, email: 'clinic@example.test',
    approvalStatus: 'approved', isActive: true, isOpen: true, subscription: { status: 'ACTIVE', plan: 'BASIC' },
    staff: [{ name: 'Test doctor', email: 'doctor@example.test', doctorId: 'TEST-1' }] });
  const [staff] = clinic.staff;
  const doctor = await User.create({ name: staff.name, email: staff.email, role: 'doctor',
    doctorAccess: { businessId: clinic._id, staffId: staff._id, doctorId: staff.doctorId, status: 'ACTIVE' } });
  const context = { business: clinic, staff };
  const first = { name: 'First Patient', phone: '98765 43210', whatsappConsent: true };
  const second = { name: 'Second Patient', phone: '+919876543211' };
  const clinicId = clinic._id;

  await assert.rejects(checkInWalkIn(clinicId, { _id: doctor._id, role: 'owner' }, first), { statusCode: 404 });
  await Business.updateOne({ _id: clinicId }, { $set: { 'queueSettings.allowWalkIns': false } });
  await assert.rejects(checkInWalkIn(clinicId, owner, first), { statusCode: 409 });
  assert.equal(await User.countDocuments({ role: 'customer' }), 0);
  await Business.updateOne({ _id: clinicId }, { $set: { 'queueSettings.allowWalkIns': true } });
  const results = await Promise.allSettled([checkInWalkIn(clinicId, owner, first), checkInWalkIn(clinicId, owner, first)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 409);
  const { booking: firstVisit } = results.find(result => result.status === 'fulfilled').value;
  const { booking: secondVisit } = await checkInWalkIn(clinicId, owner, second);
  assert.equal(await User.countDocuments({ role: 'customer' }), 2);
  assert.equal(await Booking.countDocuments({ businessId: clinicId }), 2);
  const ownerQueue = await getQueue(clinicId, null, owner);
  assert.deepEqual(ownerQueue.users.map(row => row.status), ['waiting', 'waiting']);
  assert.deepEqual(ownerQueue.users.map(row => row.userId.name), [first.name, second.name]);
  assert.equal(ownerQueue.users[0].userId.phone, undefined);
  assert.equal(ownerQueue.users[0].bookingId, undefined);
  await assert.rejects(startWalkInVisit(secondVisit.userId, context), { statusCode: 409 });
  await startWalkInVisit(firstVisit.userId, context);
  assert.equal((await Booking.findById(firstVisit.id)).status, 'serving');
  assert.equal((await Booking.findById(secondVisit.id)).status, 'waiting');

  const rx = await Prescription.create({ booking: firstVisit._id, doctor: doctor._id, business: clinicId, patient: firstVisit.userId,
    doctorName: staff.name, doctorId: staff.doctorId, patientName: first.name, clinicName: clinic.name,
    diagnosis: 'Synthetic visit', whatsappNotification: schedulePrescriptionNotification() });
  const sends = [];
  await dispatchPrescription({ id: rx.id, version: 1 }, {
    store: { reserveMessage: async () => true },
    provider: { document: async phone => { sends.push(phone); return 'wamid.test'; } },
  });
  assert.deepEqual(sends, ['+919876543210']);

  let code;
  const challenges = new Map();
  const phoneAuth = createPhoneVerification({ config: { cooldown: 60 },
    store: {
      digest: (...parts) => createHmac('sha256', 'test').update(JSON.stringify(parts)).digest('hex'),
      reserve: async ({ account, challenge }) => { challenges.set(account, challenge); return true; },
      read: async account => challenges.get(account),
      consume: async (account, id, matches) => matches && challenges.get(account)?.id === id && challenges.delete(account),
    },
    provider: { otp: async (phone, otp) => { assert.equal(phone, '+919876543210'); code = otp; return 'wamid.otp'; } },
    deliveries: { beginDelivery: async () => {}, recordDelivery: async () => {} },
  });
  const { challengeId } = await phoneAuth.sendLogin({ phone: first.phone, ip: 'fixture-ip' });
  const account = await phoneAuth.verifyLogin({ phone: first.phone, otp: code, challengeId });
  assert.equal(account.id, String(firstVisit.userId));
  assert.equal(sanitize(account).email, '');
  assert.equal(sanitize(account).isPhoneVerified, true);
  await assert.rejects(phoneAuth.verifyLogin({ phone: first.phone, otp: code, challengeId }), { statusCode: 400 });
  assert.equal(await Prescription.countDocuments({ patient: account._id }), 1);

  await callNext(clinicId, owner._id, 'owner', null, staff.name, firstVisit.userId, null, context);
  assert.equal((await Booking.findById(firstVisit.id)).status, 'completed');
  assert.equal((await Booking.findById(secondVisit.id)).status, 'serving');
  await assert.rejects(checkInWalkIn(clinicId, owner, { ...first, name: 'Unrelated Patient' }), { statusCode: 409 });
  const repeat = await checkInWalkIn(clinicId, owner, first);
  assert.equal(String(repeat.booking.userId), account.id);
  await cancelBooking(repeat.booking._id, account._id);
  assert.equal((await Booking.findById(repeat.booking._id)).status, 'cancelled');
  assert.deepEqual((await getQueue(clinicId, null, owner)).users.map(row => row.userId.name), [second.name]);
});
