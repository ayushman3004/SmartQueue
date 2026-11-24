import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { deliverDueFollowUps, scheduleFollowUp } from '../src/modules/doctor/follow-up-reminder.service.js';
import Prescription from '../src/modules/doctor/prescription.model.js';
import { encryptPrescription } from '../src/modules/doctor/prescription-encryption.js';
import User from '../src/modules/auth/auth.model.js';
import Notification from '../src/modules/notification/notification.model.js';

test('follow-up reminders use the previous morning in IST or run immediately if that time passed', () => {
  const now = new Date('2026-11-23T08:00:00Z');
  assert.deepEqual(scheduleFollowUp('', now), {});
  assert.throws(() => scheduleFollowUp('2026-11-31', now), /valid follow-up date/);
  assert.throws(() => scheduleFollowUp('2026-11-23', now), /future follow-up date/);
  assert.equal(scheduleFollowUp('2026-11-25', now).reminderNextRunAt.toISOString(), '2026-11-24T03:30:00.000Z');
  assert.equal(scheduleFollowUp('2026-11-24', now).reminderNextRunAt.toISOString(), now.toISOString());
});

test('competing workers send one private inbox reminder for encrypted and legacy prescriptions', async t => {
  const due = new Date('2026-11-23T09:00:00Z');
  const originalKey = process.env.PRESCRIPTION_ENCRYPTION_KEY;
  process.env.PRESCRIPTION_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  t.after(() => {
    if (originalKey === undefined) delete process.env.PRESCRIPTION_ENCRYPTION_KEY;
    else process.env.PRESCRIPTION_ENCRYPTION_KEY = originalKey;
  });
  const record = { _id: 'first', patient: 'opt-in', doctor: 'doctor', booking: 'booking', business: 'clinic' };
  const reminders = [
    { ...record, encryptedClinicalData: encryptPrescription(record, { followUpDate: '2026-11-24' }) },
    { _id: 'second', patient: 'changed-phone', followUpDate: '2026-11-24' },
  ];
  const pending = new Set(reminders.map(reminder => reminder._id));
  const claimed = new Set();
  t.mock.method(Prescription, 'find', () => ({
    select: () => ({ sort: () => ({ limit: () => ({ lean: async () => reminders }) }) }),
  }));
  t.mock.method(Prescription, 'updateOne', async (filter, update) => {
    if (update.$unset) {
      pending.delete(filter._id);
      return { modifiedCount: 1 };
    }
    if (!pending.has(filter._id) || claimed.has(filter._id)) return { modifiedCount: 0 };
    claimed.add(filter._id);
    return { modifiedCount: 1 };
  });
  t.mock.method(User, 'findById', id => ({ select: async () => ({ _id: id }) }));
  const inbox = [];
  t.mock.method(Notification, 'create', async payload => { inbox.push(payload); return payload; });
  await Promise.all([deliverDueFollowUps(null, due), deliverDueFollowUps(null, due)]);
  assert.deepEqual(inbox.map(item => item.eventKey).sort(), ['prescription:follow-up:first', 'prescription:follow-up:second']);
  assert.ok(inbox.every(item => item.href === '/history'));
  assert.equal(pending.size, 0);
});
