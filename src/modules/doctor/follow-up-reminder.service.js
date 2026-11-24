import ApiError from '../../../utils/ApiError.js';
import User from '../auth/auth.model.js';
import { createNotification } from '../notification/notification.service.js';
import { getBusinessDate } from '../../utils/bookingDates.js';
import Prescription from './prescription.model.js';
import { readPrescription } from './prescription-encryption.js';

export function scheduleFollowUp(value, now = new Date()) {
  if (value === undefined || value === '') return {};
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, 'Enter a valid follow-up date.');
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, 'Enter a valid follow-up date.');
  }
  if (value <= getBusinessDate(now)) throw new ApiError(400, 'Choose a future follow-up date.');
  const morningOfFollowUp = new Date(`${value}T09:00:00+05:30`);
  return {
    followUpDate: value,
    reminderNextRunAt: new Date(Math.max(now.getTime(), morningOfFollowUp.getTime() - 86_400_000)),
    reminderExpiresAt: new Date(`${value}T23:59:59+05:30`),
  };
}

async function deliverReminder(prescription, leaseUntil, io) {
  const patient = await User.findById(prescription.patient)
    .select('_id');
  if (patient) {
    const { followUpDate } = readPrescription(prescription);
    const day = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'UTC' })
      .format(new Date(`${followUpDate}T00:00:00Z`));
    await createNotification({
      recipient: prescription.patient,
      type: 'account',
      title: 'Follow-up reminder',
      message: `Your follow-up is due on ${day}. Sign in to view your prescription and arrange the visit.`,
      href: '/history',
      eventKey: `prescription:follow-up:${prescription._id}`,
    }, io);

  }
  await Prescription.updateOne({ _id: prescription._id, reminderNextRunAt: leaseUntil }, {
    $unset: { reminderNextRunAt: '', reminderExpiresAt: '' },
  });
}

export async function deliverDueFollowUps(io, now = new Date()) {
  const due = { reminderNextRunAt: { $exists: true, $lte: now }, reminderExpiresAt: { $gte: now } };
  const reminders = await Prescription.find(due).select('booking business doctor patient followUpDate encryptedClinicalData').sort({ reminderNextRunAt: 1 }).limit(50).lean();
  for (const reminder of reminders) {
    const leaseUntil = new Date(Math.max(Date.now(), now.getTime()) + 60_000);
    const claim = await Prescription.updateOne({ _id: reminder._id, ...due }, { $set: { reminderNextRunAt: leaseUntil } });
    if (!claim.modifiedCount) continue;
    try {
      await deliverReminder(reminder, leaseUntil, io);
    } catch (error) {
      console.error('Follow-up reminder processing failed', { prescription: String(reminder._id), code: error.code });
    }
  }
}

export function startFollowUpReminderWorker(io) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await deliverDueFollowUps(io);
    } catch (error) {
      console.error('Follow-up reminder worker failed', { code: error.code });
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(tick, 30_000);
  timer.unref?.();
  return () => clearInterval(timer);
}
