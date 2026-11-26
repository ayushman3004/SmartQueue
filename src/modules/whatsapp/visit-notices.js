import { randomUUID } from 'node:crypto';
import Booking from '../../booking/booking.model.js';
import Queue from '../../queue/queue.model.js';
import User from '../auth/auth.model.js';
import Business from '../business/business.model.js';
import Prescription from '../doctor/prescription.model.js';
import Notification from '../notification/notification.model.js';
import { turnNotificationPayload } from '../notification/notification.service.js';
import { getActiveClinicPlan } from '../subscription/clinic-capacity.service.js';
import { isClinic } from '../doctor/doctor-access.js';
import { hasVisitNoticeConsent } from '../../shared/visitNoticeConsent.js';
import { normalizePhoneNumber } from '../../utils/phoneNumbers.js';
import { beginDelivery, markDeliveryRejected, recordDelivery } from './whatsapp-delivery.model.js';

const outbox = 'whatsappVisitNotice';
const field = key => `${outbox}.${key}`;
const appointmentStatuses = ['confirmed', 'scheduled'];
const targets = {
  appointment: { model: Booking, fields: 'businessId userId startTime status', business: 'businessId', patient: 'userId', plan: 'BASIC' },
  followUp: { model: Prescription, fields: 'business patient booking', business: 'business', patient: 'patient', plan: 'PRO' },
  queueTurn: { model: Notification, fields: 'recipient eventKey +clinicForWhatsApp', business: 'clinicForWhatsApp', patient: 'recipient', plan: 'PRO' },
};

async function eligiblePhone(kind, target, record) {
  const businessId = record[target.business];
  const patientId = record[target.patient];
  const clinic = await Business.findById(businessId, 'owner category isActive approvalStatus subscription whatsappQueueTurnAlerts');
  if (!isClinic(clinic) || !clinic.isActive || clinic.approvalStatus !== 'approved') return null;
  const plan = await getActiveClinicPlan(clinic);
  if (!plan || (target.plan === 'PRO' && plan.id !== 'PRO')) return null;

  if (kind === 'appointment' && (!appointmentStatuses.includes(record.status) || record.startTime <= new Date())) return null;
  if (kind === 'followUp' && !await Booking.exists({ _id: record.booking, businessId, userId: patientId,
    status: { $nin: ['cancelled', 'refunded'] } })) return null;
  if (kind === 'queueTurn') {
    if (!clinic.whatsappQueueTurnAlerts) return null;
    const queue = await Queue.findOne({ businessId }, { users: 1 }).lean();
    const sameTurn = queue?.users.some(row => row.status === 'serving' && String(row.userId) === String(patientId) &&
      turnNotificationPayload(clinic, row).eventKey === record.eventKey);
    if (!sameTurn) return null;
  }

  const patient = await User.findById(patientId, 'role phone phoneVerification isPhoneVerified whatsappVerifiedAt clinicVisitWhatsAppConsent').lean();
  return hasVisitNoticeConsent(patient, record[outbox].createdAt) ? normalizePhoneNumber(patient.phone) : null;
}

function due(now) {
  return {
    [field('expiresAt')]: { $gt: now },
    $or: [
      { [field('state')]: 'pending', [field('nextAt')]: { $lte: now } },
      { [field('state')]: 'claimed', [field('leaseUntil')]: { $lte: now } },
    ],
  };
}

async function dispatch(kind, target, id, { store, provider }) {
  const now = new Date();
  const lease = randomUUID();
  const claimed = await target.model.findOneAndUpdate({ _id: id, ...due(now) }, { $set: {
    [field('state')]: 'claimed', [field('lease')]: lease, [field('leaseUntil')]: new Date(now.getTime() + 60_000),
  } }, { returnDocument: 'after' }).select(`${target.fields} +${outbox}`).lean();
  if (!claimed) return;
  const owned = { _id: id, [field('lease')]: lease };
  const finish = (state, nextAt) => target.model.updateOne(owned, {
    $set: { [field('state')]: state, ...(nextAt && { [field('nextAt')]: nextAt }) },
    $unset: { [field('lease')]: '', [field('leaseUntil')]: '' },
  });

  if (!await eligiblePhone(kind, target, claimed)) return finish('skipped');
  if (!await store.reserveMessage()) return finish('pending', new Date(Date.now() + 60_000));
  await beginDelivery(lease, 'visit_notice');
  const sending = await target.model.updateOne({ ...owned, [field('state')]: 'claimed', [field('leaseUntil')]: { $gt: new Date() } }, {
    $set: { [field('state')]: 'sending' }, $inc: { [field('attempts')]: 1 },
  });
  if (!sending.modifiedCount) return;

  const current = await target.model.findById(id).select(`${target.fields} +${outbox}`).lean();
  const phone = current && current[outbox].expiresAt > new Date() && await eligiblePhone(kind, target, current);
  if (!phone) {
    await markDeliveryRejected(lease, 'skipped');
    return finish('skipped');
  }

  let providerId;
  try { providerId = await provider.visitNotice(kind, phone, lease); }
  catch (error) {
    const outcome = error.outcome || 'unknown';
    await markDeliveryRejected(lease, outcome);
    if (outcome === 'retry' && claimed[outbox].attempts < 4) {
      return finish('pending', new Date(Date.now() + 60_000 * 2 ** claimed[outbox].attempts));
    }
    return finish(outcome === 'unknown' ? 'unknown' : 'failed');
  }
  await recordDelivery({ callback: lease, providerId, status: 'accepted', at: new Date() });
  await finish('accepted');
}

export async function deliverWhatsAppVisitNotices(runtime) {
  for (const [kind, target] of Object.entries(targets)) {
    if (!runtime.config.visitTemplates?.[kind]) continue;
    const now = new Date();
    await target.model.updateMany({ [field('state')]: 'sending', [field('leaseUntil')]: { $lte: now } }, {
      $set: { [field('state')]: 'unknown' }, $unset: { [field('lease')]: '', [field('leaseUntil')]: '' },
    });
    await target.model.updateMany({ [field('state')]: { $in: ['pending', 'claimed'] }, [field('expiresAt')]: { $lte: now } }, {
      $set: { [field('state')]: 'expired' }, $unset: { [field('lease')]: '', [field('leaseUntil')]: '' },
    });
    const upcoming = await target.model.find(due(now), '_id').sort({ [field('nextAt')]: 1 }).limit(10).lean();
    const results = await Promise.allSettled(upcoming.map(({ _id }) => dispatch(kind, target, _id, runtime)));
    if (results.some(result => result.status === 'rejected')) console.error('WhatsApp visit notice dispatch failed');
  }
}

export function startWhatsAppVisitNoticeWorker(runtime) {
  if (!runtime?.config.workerEnabled || !Object.keys(runtime.config.visitTemplates || {}).length) return async () => {};
  let active;
  const tick = () => {
    if (!active) active = deliverWhatsAppVisitNotices(runtime)
      .catch(() => console.error('WhatsApp visit notice worker failed'))
      .finally(() => { active = undefined; });
  };
  void tick();
  const timer = setInterval(tick, 15_000).unref();
  return async () => { clearInterval(timer); await active; };
}
