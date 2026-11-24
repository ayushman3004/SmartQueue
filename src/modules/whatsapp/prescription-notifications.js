import { randomUUID } from 'node:crypto';
import { Queue, Worker } from 'bullmq';
import { createClient } from 'redis';
import Prescription from '../doctor/prescription.model.js';
import User from '../auth/auth.model.js';
import { hasWhatsAppVerifiedPhone } from '../../utils/phoneNumbers.js';
import { whatsappConsentVersion } from '../auth/phone-security.js';
import Delivery, { beginDelivery, markDeliveryRejected, recordDelivery } from './whatsapp-delivery.model.js';

const queueName = 'serveq-whatsapp-documents-v1';
const path = 'whatsappNotification';
const field = name => `${path}.${name}`;
const leaseMs = 60_000;
const expiryMs = 24 * 60 * 60_000;
const attemptsLimit = 5;

export const schedulePrescriptionNotification = (now = new Date()) => ({
  version: 1, state: 'pending', attempts: 0, createdAt: now, nextAt: now,
  expiresAt: new Date(now.getTime() + expiryMs),
});

export function eligiblePrescriptionRecipient(user, scheduledAt) {
  return user?.role === 'customer' && hasWhatsAppVerifiedPhone(user) && user.whatsappConsent === true &&
    user.whatsappConsentVersion === whatsappConsentVersion && Boolean(user.whatsappConsentAt) &&
    new Date(user.whatsappConsentAt) <= scheduledAt && new Date(user.whatsappVerifiedAt) <= scheduledAt &&
    (!user.whatsappConsentRevokedAt || new Date(user.whatsappConsentRevokedAt) < new Date(user.whatsappConsentAt));
}

export async function dispatchPrescription({ id, version }, { store, provider, now = new Date() }) {
  const due = { _id: id, [field('version')]: version, [field('state')]: 'pending',
    [field('nextAt')]: { $lte: now }, [field('expiresAt')]: { $gt: now } };
  const lease = randomUUID();
  const leaseUntil = new Date(now.getTime() + leaseMs);
  const record = await Prescription.findOneAndUpdate(due, { $set: {
    [field('state')]: 'claimed', [field('lease')]: lease, [field('leaseUntil')]: leaseUntil,
  } }, { returnDocument: 'after' }).select('patient +whatsappNotification').lean();
  if (!record) return;
  const owned = { _id: id, [field('lease')]: lease };
  const outbox = record.whatsappNotification;
  async function finish(state, nextAt, reason) {
    await Prescription.updateOne(owned, {
      $set: { [field('state')]: state, ...(nextAt && { [field('nextAt')]: nextAt }), ...(reason && { [field('reason')]: reason }) },
      $unset: { [field('lease')]: '', [field('leaseUntil')]: '' },
    });
  }

  const lookup = () => User.findById(record.patient).select('role phone isPhoneVerified phoneVerification whatsappVerifiedAt whatsappConsent whatsappConsentAt whatsappConsentRevokedAt whatsappConsentVersion').lean();
  if (!eligiblePrescriptionRecipient(await lookup(), outbox.createdAt)) return finish('skipped', null, 'ineligible');
  if (!await store.reserveMessage()) return finish('pending', new Date(now.getTime() + 15 * 60_000), 'budget');
  await beginDelivery(lease, 'prescription');

  const transition = await Prescription.updateOne({ ...owned, [field('state')]: 'claimed', [field('leaseUntil')]: { $gt: new Date() } }, {
    $set: { [field('state')]: 'sending', [field('callback')]: lease },
    $inc: { [field('attempts')]: 1 },
    $unset: { [field('reason')]: '' },
  });
  if (!transition.modifiedCount) return;

  const patient = await lookup();
  if (!eligiblePrescriptionRecipient(patient, outbox.createdAt)) {
    await markDeliveryRejected(lease, 'skipped');
    return finish('skipped', null, 'ineligible');
  }

  let providerId;
  try { providerId = await provider.document(patient.phone, lease); }
  catch (error) {
    const outcome = error.outcome || 'unknown';
    await markDeliveryRejected(lease, outcome);
    if (outcome === 'unknown') return finish('unknown', null, 'ambiguous');
    const attempts = outbox.attempts + 1;
    if (outcome === 'retry' && attempts < attemptsLimit) {
      return finish('pending', new Date(Date.now() + 60_000 * 2 ** (attempts - 1)), 'provider_throttled');
    }
    return finish('failed', null, outcome === 'retry' ? 'attempts_exhausted' : 'provider_rejected');
  }
  await recordDelivery({ callback: lease, providerId, status: 'accepted', at: new Date() });
  await finish('accepted');
}

async function recover(now) {
  await Prescription.updateMany({ [field('state')]: 'claimed', [field('leaseUntil')]: { $lte: now } }, {
    $set: { [field('state')]: 'pending', [field('nextAt')]: now },
    $unset: { [field('lease')]: '', [field('leaseUntil')]: '' },
  });
  await Prescription.updateMany({ [field('state')]: 'sending', [field('leaseUntil')]: { $lte: now } }, {
    $set: { [field('state')]: 'unknown', [field('reason')]: 'ambiguous' },
    $unset: { [field('lease')]: '', [field('leaseUntil')]: '' },
  });
  await Prescription.updateMany({ [field('state')]: 'pending', [field('expiresAt')]: { $lte: now } }, {
    $set: { [field('state')]: 'failed', [field('reason')]: 'expired' },
  });
}

export async function prescriptionDeliveryStatus(record) {
  const outbox = record?.whatsappNotification;
  if (!outbox) return undefined;
  if (!outbox.callback || ['pending', 'claimed', 'skipped'].includes(outbox.state)) return outbox.state;
  const delivery = await Delivery.findById(outbox.callback).select('status rank').lean();
  return delivery?.rank ? delivery.status : outbox.state;
}

export function startPrescriptionNotificationWorker({ config, store, provider }) {
  if (!config.workerEnabled) return async () => {};
  const producer = createClient({ url: config.redisUrl, disableOfflineQueue: true, socket: { connectTimeout: 3000 } });
  const consumer = createClient({ url: config.redisUrl, socket: { connectTimeout: 3000 } });
  const queue = new Queue(queueName, { connection: producer });
  const worker = new Worker(queueName, job => dispatchPrescription(job.data, { store, provider }), {
    connection: consumer, concurrency: 2,
  });
  let lastError = 0;
  function reportFailure() {
    if (Date.now() - lastError < 60_000) return;
    lastError = Date.now();
    console.error('WhatsApp prescription queue unavailable or dispatch failed');
  }
  queue.on('error', reportFailure);
  worker.on('error', reportFailure);
  worker.on('failed', reportFailure);
  let active;
  let lastBacklog = 0;
  const tick = () => {
    if (active || !producer.isReady) return;
    active = (async () => {
      const now = new Date();
      await recover(now);
      const pending = await Prescription.find({ [field('state')]: 'pending', [field('nextAt')]: { $lte: now } })
        .sort({ [field('nextAt')]: 1 }).limit(50).select('_id +whatsappNotification').lean();
      if (pending.length === 50 && now.getTime() - lastBacklog >= 60_000) {
        lastBacklog = now.getTime();
        console.warn('WhatsApp prescription backlog has at least 50 due events');
      }
      if (!pending.length) return;
      const bucket = Math.floor(now.getTime() / 60_000);
      await queue.addBulk(pending.map(({ _id, whatsappNotification }) => ({
        name: 'prescription',
        data: { id: String(_id), version: whatsappNotification.version },
        opts: {
          jobId: `rx-${_id}-${whatsappNotification.version}-${bucket}`,
          removeOnComplete: true, removeOnFail: { age: 7 * 86_400, count: 1000 },
        },
      })));
    })().catch(reportFailure).finally(() => { active = undefined; });
  };
  const timer = setInterval(tick, 15_000);
  timer.unref();
  producer.on('ready', tick);
  tick();
  return async () => {
    clearInterval(timer);
    producer.off('ready', tick);
    await active;
    try { await Promise.all([worker.close(), queue.close()]); }
    finally {
      if (producer.isOpen) producer.destroy();
      if (consumer.isOpen) consumer.destroy();
    }
  };
}
