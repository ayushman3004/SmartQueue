import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import Booking from '../src/booking/booking.model.js';
import { advanceAppointmentService, getAvailableSlots } from '../src/booking/booking.service.js';
import User from '../src/modules/auth/auth.model.js';
import { updateVisitNoticeConsent } from '../src/modules/auth/whatsapp-visit-consent.service.js';
import Business from '../src/modules/business/business.model.js';
import { launchBusiness, updateBusiness } from '../src/modules/business/business.service.js';
import { notifyServingTurns } from '../src/modules/notification/notification.service.js';
import Prescription from '../src/modules/doctor/prescription.model.js';
import Delivery from '../src/modules/whatsapp/whatsapp-delivery.model.js';
import { isWithinClinicCapacity } from '../src/modules/subscription/clinic-capacity.service.js';
import { scheduleVisitNotice } from '../src/modules/whatsapp/visit-notice-outbox.js';
import { deliverWhatsAppVisitNotices } from '../src/modules/whatsapp/visit-notices.js';
import { visitNoticeConsentVersion, hasVisitNoticeConsent } from '../src/shared/visitNoticeConsent.js';
import { getBusinessDate } from '../src/utils/bookingDates.js';
import Queue from '../src/queue/queue.model.js';
import QueueDS from '../src/queue/queue.ds.js';
import { advanceQueueService } from '../src/queue/queue.service.js';

const phone = '+919876543210';
const proofTime = new Date('2026-01-01');
const verifiedPhone = {
  phone, phoneVerification: { phone, provider: 'whatsapp', verifiedAt: proofTime },
  isPhoneVerified: true, whatsappVerifiedAt: proofTime,
};

test('visit notice consent requires the current WhatsApp proof and a separate opt-in before scheduling', () => {
  const patient = { role: 'customer', ...verifiedPhone, whatsappConsent: true };
  const date = new Date('2026-02-01');
  assert.equal(hasVisitNoticeConsent(patient, date), false);
  const consent = { enabled: true, version: visitNoticeConsentVersion, grantedAt: new Date('2026-01-02'), phoneProofAt: proofTime, phone };
  const optedIn = { ...patient, clinicVisitWhatsAppConsent: consent };
  assert.equal(hasVisitNoticeConsent(optedIn, date), true);
  assert.equal(hasVisitNoticeConsent(optedIn, proofTime), false);
  assert.equal(hasVisitNoticeConsent({ ...optedIn, role: 'owner' }, date), false);
  assert.equal(hasVisitNoticeConsent({ ...optedIn, whatsappVerifiedAt: date }, date), false);
});

const mongo = process.env.WALK_IN_TEST_MONGO_URL;
test('clinic quotas serialize launches and WhatsApp rechecks plan, visit status, and consent before dispatch', { skip: !mongo }, async t => {
  const dbName = `subscription_entitlements_${randomBytes(8).toString('hex')}`;
  await mongoose.connect(mongo, { dbName });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await Promise.all([Business.init(), Booking.init(), User.init(), Prescription.init(), Delivery.init()]);

  const basic = { plan: 'BASIC', status: 'ACTIVE' };
  const pro = { plan: 'PRO', status: 'ACTIVE' };
  const owner = await User.create({ name: 'Clinic owner', email: 'owner@example.test', role: 'owner', subscription: basic });
  const proOwner = await User.create({ name: 'Pro clinic owner', email: 'pro@example.test', role: 'owner', subscription: pro });
  const clinicData = index => ({ name: `Clinic ${index}`, category: 'clinic', owner: owner._id, address: 'Test address',
    subscription: basic, isActive: index < 2, isOpen: false,
    staff: [{ name: 'Test Doctor' }], onboarding: { status: 'IN_PROGRESS', completedSteps: [1] },
  });
  const clinics = await Business.insertMany(Array.from({ length: 6 }, (_, index) => clinicData(index)));
  const launches = await Promise.allSettled(clinics.slice(2, 4).map(clinic => launchBusiness(clinic._id, owner._id)));
  assert.equal(launches.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(launches.find(result => result.status === 'rejected').reason.statusCode, 409);
  assert.equal(await Business.countDocuments({ owner: owner._id, isActive: true }), 3);
  await assert.rejects(updateBusiness(clinics[0]._id, owner._id, { whatsappQueueTurnAlerts: true }, 'owner'), { statusCode: 403 });

  await User.updateOne({ _id: owner._id }, { $set: { subscription: pro } });
  for (const clinic of await Business.find({ owner: owner._id, isActive: false }).sort('_id').limit(2)) await launchBusiness(clinic._id, owner._id);
  await assert.rejects(launchBusiness(clinics[5]._id, owner._id), { statusCode: 409 });
  assert.equal(await Business.countDocuments({ owner: owner._id, isActive: true }), 5);
  const updated = await updateBusiness(clinics[0]._id, owner._id, {
    whatsappQueueTurnAlerts: true, queueRooms: [{ staffId: String(clinics[0].staff[0]._id), name: 'Room 1' }],
  }, 'owner');
  assert.equal(updated.queueRooms[0].name, 'Room 1');
  await assert.rejects(updateBusiness(clinics[0]._id, proOwner._id, { queueRooms: [] }, 'owner'), { statusCode: 403 });
  await User.updateOne({ _id: owner._id }, { $set: { subscription: basic } });
  assert.equal(await isWithinClinicCapacity(clinics[0]), true);
  const overCapacity = await Business.findById(clinics[4]._id);
  assert.equal(await isWithinClinicCapacity(overCapacity), false);
  await assert.rejects(getAvailableSlots(overCapacity._id, getBusinessDate(new Date())), { statusCode: 403, message: /capacity/ });
  assert.equal(overCapacity.isActive, true);

  const patient = await User.create({ name: 'Test patient', email: 'patient@example.test', ...verifiedPhone });
  await updateVisitNoticeConsent(patient, true, visitNoticeConsentVersion);
  const proClinic = await Business.create({ ...clinicData(0), owner: proOwner._id, subscription: pro, whatsappQueueTurnAlerts: true });
  const now = Date.now();
  const newNotice = () => scheduleVisitNotice(new Date(now - 1_000), new Date(now + 60_000), new Date(now + 1));
  const bookingData = { userId: patient._id, startTime: new Date(now + 60_000), endTime: new Date(now + 961_000), duration: 15 };
  const [appointment, cancelled, basicVisit, proVisit] = await Booking.create([
    { ...bookingData, businessId: clinics[0]._id, status: 'confirmed', whatsappVisitNotice: newNotice() },
    { ...bookingData, businessId: clinics[0]._id, status: 'cancelled', whatsappVisitNotice: newNotice() },
    { ...bookingData, businessId: clinics[0]._id, status: 'completed' },
    { ...bookingData, businessId: proClinic._id, status: 'completed' },
  ]);
  const key = process.env.PRESCRIPTION_ENCRYPTION_KEY;
  process.env.PRESCRIPTION_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  t.after(() => { if (key === undefined) delete process.env.PRESCRIPTION_ENCRYPTION_KEY; else process.env.PRESCRIPTION_ENCRYPTION_KEY = key; });
  const [basicFollowUp, proFollowUp] = await Prescription.create([basicVisit, proVisit].map(visit => ({
    booking: visit._id, business: visit.businessId, doctor: new mongoose.Types.ObjectId(), patient: patient._id,
    doctorName: 'Test doctor', doctorId: 'TEST', patientName: 'Test patient', clinicName: 'Test clinic',
    diagnosis: 'Synthetic diagnosis', whatsappVisitNotice: newNotice(),
  })));
  const inQueue = (clinic, booking) => ({ userId: patient._id, bookingId: booking._id, status: 'serving', serviceTime: 20,
    assignedStaff: { staffId: clinic.staff[0]._id, name: clinic.staff[0].name },
    services: [{ name: 'First service', duration: 10 }, { name: 'Second service', duration: 10 }],
  });
  const firstClinic = await Business.findById(clinics[0]._id);
  const basicQueue = await Queue.findOneAndUpdate({ businessId: firstClinic._id }, { $set: { users: [inQueue(firstClinic, basicVisit)] } }, { upsert: true, returnDocument: 'after' });
  const proQueue = await Queue.create({ businessId: proClinic._id, users: [inQueue(proClinic, proVisit)] });
  await assert.rejects(advanceQueueService(basicQueue, patient._id, 0, { business: firstClinic, staff: firstClinic.staff[0] }), { statusCode: 403 });
  await assert.rejects(advanceQueueService(proQueue, patient._id, 0, { business: proClinic, staff: firstClinic.staff[0] }), { statusCode: 403 });
  await advanceQueueService(proQueue, patient._id, 0, { business: proClinic, staff: proClinic.staff[0] });
  assert.equal(QueueDS.fromArray(proQueue.users).toArray()[0].serviceStep, 1);
  await assert.rejects(advanceQueueService(proQueue, patient._id, 0, { business: proClinic, staff: proClinic.staff[0] }), { statusCode: 409 });
  const proDoctor = { business: proClinic, staff: proClinic.staff[0] };
  const appointmentInProgress = await Booking.create({ ...bookingData, businessId: proClinic._id, status: 'serving',
    assignedStaff: proQueue.users[0].assignedStaff, services: proQueue.users[0].services,
  });
  await advanceAppointmentService(appointmentInProgress, 0, proDoctor);
  await assert.rejects(advanceAppointmentService(appointmentInProgress, 0, proDoctor), { statusCode: 409 });
  assert.equal((await Booking.findById(appointmentInProgress._id)).serviceStep, 1);
  await Promise.all([notifyServingTurns(firstClinic, basicQueue.users), notifyServingTurns(proClinic, proQueue.users)]);
  const calls = [];
  const runtime = {
    config: { visitTemplates: { appointment: 'test_appointment', followUp: 'test_follow_up', queueTurn: 'test_queue_turn' } },
    store: { reserveMessage: async () => true },
    provider: { visitNotice: async (kind, destination, callback) => {
      assert.equal(destination, phone);
      assert.match(callback, /^[a-f0-9-]{36}$/);
      calls.push(kind);
      return `wamid.test-${kind}`;
    } },
  };
  await Promise.all([deliverWhatsAppVisitNotices(runtime), deliverWhatsAppVisitNotices(runtime)]);
  assert.deepEqual(calls.sort(), ['appointment', 'followUp', 'queueTurn']);
  const state = async (Model, doc) => (await Model.findById(doc._id).select('+whatsappVisitNotice')).whatsappVisitNotice.state;
  assert.equal(await state(Booking, appointment), 'accepted');
  assert.equal(await state(Booking, cancelled), 'skipped');
  assert.equal(await state(Prescription, basicFollowUp), 'skipped');
  assert.equal(await state(Prescription, proFollowUp), 'accepted');
  assert.equal(appointment.toJSON().whatsappVisitNotice, undefined);
  await updateVisitNoticeConsent(await User.findById(patient._id), false);
  const withdrawn = await Booking.create({ ...bookingData, businessId: clinics[0]._id, status: 'confirmed', whatsappVisitNotice: newNotice() });
  await deliverWhatsAppVisitNotices(runtime);
  assert.equal(await state(Booking, withdrawn), 'skipped');
  assert.equal(calls.length, 3);
});
