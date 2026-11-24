import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import { randomBytes, createHmac, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import webhookRoutes from '../src/modules/whatsapp/whatsapp-webhook.routes.js';
import Delivery from '../src/modules/whatsapp/whatsapp-delivery.model.js';
import User from '../src/modules/auth/auth.model.js';
import Prescription from '../src/modules/doctor/prescription.model.js';
import { whatsappConsentVersion } from '../src/modules/auth/phone-security.js';
import { updateWhatsAppConsent } from '../src/modules/auth/whatsapp-consent.service.js';
import {
  schedulePrescriptionNotification, eligiblePrescriptionRecipient, dispatchPrescription,
  prescriptionDeliveryStatus, startPrescriptionNotificationWorker,
} from '../src/modules/whatsapp/prescription-notifications.js';

const config = { enabled: true, businessAccountId: '10', phoneNumberId: '20',
  appSecret: 'test-only-secret', verifyToken: 'test-only-verification-token' };
const callback = randomUUID();
const event = status => ({
  object: 'whatsapp_business_account',
  entry: [{ id: '10', changes: [{ field: 'messages', value: {
    metadata: { phone_number_id: '20' },
    statuses: [{ id: 'wamid.test', timestamp: '1732000000', status, biz_opaque_callback_data: callback,
      recipient_id: '919876543210' }],
  } }] }],
});

test('webhook requires exact raw signature and account scope; duplicate and out-of-order statuses do not downgrade', async t => {
  const app = express();
  app.locals.whatsapp = { config };
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use('/api/whatsapp/webhook', webhookRoutes);
  const server = await new Promise((resolve, reject) => {
    const socket = app.listen(0, '127.0.0.1', () => resolve(socket));
    socket.on('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));

  let rank = 0;
  let recorded = null;
  const writes = t.mock.method(Delivery, 'updateOne', async (filter, update) => {
    assert.equal(filter._id, callback);
    assert.equal(update.$set.providerId, 'wamid.test');
    assert.equal(update.$set.recipient_id, undefined);
    if (rank < filter.rank.$lt) {
      recorded = update.$set.status;
      rank = update.$set.rank;
    }
  });
  const url = `http://127.0.0.1:${server.address().port}/api/whatsapp/webhook`;
  const signed = body => 'sha256=' + createHmac('sha256', config.appSecret).update(body).digest('hex');
  const send = (body, signature) => fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(signature && { 'X-Hub-Signature-256': signature }) }, body,
  });
  const challenge = '?hub.mode=subscribe&hub.challenge=123&hub.verify_token=';
  assert.equal((await fetch(url + challenge + 'invalid')).status, 403);
  assert.equal(await (await fetch(url + challenge + config.verifyToken)).text(), '123');
  const read = JSON.stringify(event('read'));
  assert.equal((await send(read)).status, 403);
  assert.equal((await send(read + ' ', signed(read))).status, 403);
  assert.equal(writes.mock.callCount(), 0);
  for (const status of ['read', 'sent', 'read', 'failed', 'delivered']) {
    const body = JSON.stringify(event(status));
    assert.equal((await send(body, signed(body))).status, 200);
  }
  assert.equal(recorded, 'read');
  assert.equal(writes.mock.callCount(), 5);
  const wrongAccount = event('read');
  wrongAccount.entry[0].id = '99';
  const body = JSON.stringify(wrongAccount);
  assert.equal((await send(body, signed(body))).status, 200);
  assert.equal(writes.mock.callCount(), 5);
});

const phone = '+919876543210';
const initial = new Date('2026-01-01');
const recipient = {
  role: 'customer', phone, whatsappVerifiedAt: initial, isPhoneVerified: true,
  phoneVerification: { provider: 'whatsapp', phone, verifiedAt: initial },
  whatsappConsent: true, whatsappConsentAt: initial, whatsappConsentVersion,
};

test('eligibility requires WhatsApp proof and explicit consent before finalization', async () => {
  const later = new Date(initial.getTime() + 1000);
  assert.equal(eligiblePrescriptionRecipient(recipient, later), true);
  for (const unsuitable of [
    { ...recipient, phoneVerification: { ...recipient.phoneVerification, provider: 'firebase' } },
    { ...recipient, whatsappConsent: false },
    { ...recipient, whatsappConsentVersion: undefined },
    { ...recipient, whatsappConsentRevokedAt: later },
    { ...recipient, whatsappConsentAt: new Date(later.getTime() + 1) },
    { ...recipient, phone: '+919876543211' },
  ]) assert.equal(eligiblePrescriptionRecipient(unsuitable, later), false);
  await assert.rejects(updateWhatsAppConsent({ ...recipient, whatsappVerifiedAt: undefined }, true, whatsappConsentVersion), { statusCode: 400 });
  await assert.rejects(updateWhatsAppConsent(recipient, true, 'old-notice'), { statusCode: 400 });
});

const mongoUrl = process.env.WHATSAPP_TEST_MONGO_URL;
const redisUrl = process.env.RATE_LIMIT_TEST_REDIS_URL;
test('MongoDB and BullMQ recover pending prescriptions, suppress duplicates, and handle retries and consent withdrawal',
  { skip: !mongoUrl || !redisUrl }, async t => {
    const key = process.env.PRESCRIPTION_ENCRYPTION_KEY;
    process.env.PRESCRIPTION_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    await mongoose.connect(mongoUrl, { dbName: `whatsapp_test_${randomBytes(8).toString('hex')}` });
    t.after(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      if (key === undefined) delete process.env.PRESCRIPTION_ENCRYPTION_KEY;
      else process.env.PRESCRIPTION_ENCRYPTION_KEY = key;
    });
    await Promise.all([Prescription.init(), User.init(), Delivery.init()]);
    const oid = () => new mongoose.Types.ObjectId();
    const patient = await User.create({ name: 'Test patient', email: 'wa-test@example.test', ...recipient });
    assert.equal((await updateWhatsAppConsent(patient, false)).user.whatsappConsent, false);
    const revoked = await User.findById(patient._id).select('+whatsappAudit');
    assert.equal(revoked.whatsappAudit[0].action, 'consent_revoked');

    const makePrescription = whatsappNotification => Prescription.create({
      booking: oid(), business: oid(), doctor: oid(), patient: patient._id,
      doctorName: 'Test doctor', doctorId: 'test', patientName: 'Test patient', clinicName: 'Test clinic',
      diagnosis: 'synthetic private data', whatsappNotification,
    });
    const selected = id => Prescription.findById(id).select('+whatsappNotification');
    const queued = (prescription, deps) => dispatchPrescription({ id: prescription._id, version: 1 }, deps);
    const store = { reserveMessage: async () => true };
    let providerCalls = 0;
    const provider = { document: async (receiver, correlation) => {
      assert.equal(receiver, phone);
      assert.match(correlation, /^[a-f0-9-]{36}$/);
      providerCalls++;
      return `wamid.test${providerCalls}`;
    }};
    const blocked = await makePrescription(schedulePrescriptionNotification());
    await queued(blocked, { store, provider });
    assert.equal((await selected(blocked._id)).whatsappNotification.state, 'skipped');
    assert.equal(providerCalls, 0);

    await updateWhatsAppConsent(revoked, true, whatsappConsentVersion);
    const draft = await makePrescription(undefined);
    await queued(draft, { store, provider });
    assert.equal((await selected(draft._id)).whatsappNotification, undefined);

    const persisted = await makePrescription(schedulePrescriptionNotification());
    const raw = await Prescription.collection.findOne({ _id: persisted._id });
    assert.equal(raw.diagnosis, undefined);
    assert.equal(raw.whatsappNotification.state, 'pending');

    const url = new URL(redisUrl);
    url.pathname = '/13';
    const stop = startPrescriptionNotificationWorker({ config: { workerEnabled: true, redisUrl: url.toString() }, store, provider });
    try {
      for (let i = 0; i < 100 && (await selected(persisted._id)).whatsappNotification.state !== 'accepted'; i++) await delay(100);
      const saved = await selected(persisted._id);
      assert.equal(await prescriptionDeliveryStatus(saved), 'accepted');
      await queued(persisted, { store, provider });
      assert.equal(providerCalls, 1);
    } finally { await stop(); }

    const retry = await makePrescription(schedulePrescriptionNotification());
    let throttledAttempts = 0;
    const throttled = { store, provider: { document: async () => {
      throttledAttempts++;
      throw Object.assign(new Error('429'), { outcome: 'retry' });
    } } };
    await Promise.all([queued(retry, throttled), queued(retry, throttled)]);
    assert.equal(throttledAttempts, 1);
    const retryRecord = await selected(retry._id);
    assert.equal(retryRecord.whatsappNotification.attempts, 1);
    assert.equal(retryRecord.whatsappNotification.state, 'pending');
    assert.equal(retryRecord.whatsappNotification.reason, 'provider_throttled');
    assert.ok(retryRecord.whatsappNotification.nextAt > new Date());
    const unknown = await makePrescription(schedulePrescriptionNotification());
    await queued(unknown, { store, provider: { document: async () => { throw new Error('timeout'); } } });
    await queued(unknown, { store, provider });
    assert.equal((await selected(unknown._id)).whatsappNotification.state, 'unknown');
  });
