import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverDueFollowUps, scheduleFollowUp } from '../src/modules/doctor/follow-up-reminder.service.js';
import Prescription from '../src/modules/doctor/prescription.model.js';
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

test('competing workers send one private inbox reminder and use WhatsApp only for the verified opted-in number', async t => {
  const due = new Date('2026-11-23T09:00:00Z');
  const reminders = [
    { _id: 'first', patient: 'opt-in', followUpDate: '2026-11-24' },
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
    if (update.$set.reminderWhatsAppAttemptedAt) return { modifiedCount: 1 };
    if (!pending.has(filter._id) || claimed.has(filter._id)) return { modifiedCount: 0 };
    claimed.add(filter._id);
    return { modifiedCount: 1 };
  });
  const phone = '+919876543210';
  t.mock.method(User, 'findById', id => ({ select: async () => ({
    role: 'customer', phone, isPhoneVerified: true,
    phoneVerification: { provider: 'firebase', phone, verifiedAt: due },
    whatsappFollowUpPhone: id === 'opt-in' ? phone : '+919876543211',
  }) }));
  const inbox = [];
  t.mock.method(Notification, 'create', async payload => { inbox.push(payload); return payload; });
  const phoneNumbers = [];
  const sendWhatsApp = async recipient => phoneNumbers.push(recipient);
  await Promise.all([deliverDueFollowUps(null, sendWhatsApp, due), deliverDueFollowUps(null, sendWhatsApp, due)]);
  assert.deepEqual(inbox.map(item => item.eventKey).sort(), ['prescription:follow-up:first', 'prescription:follow-up:second']);
  assert.ok(inbox.every(item => item.href === '/history'));
  assert.deepEqual(phoneNumbers, [phone]);
  assert.equal(pending.size, 0);
});

test('WhatsApp uses an approved Meta template without sending prescription information', async () => {
  const { configuredWhatsAppSender } = await import('../src/modules/doctor/whatsapp.service.js');
  assert.equal(configuredWhatsAppSender({}), null);
  const environment = {
    WHATSAPP_ACCESS_TOKEN: 'test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456',
    WHATSAPP_FOLLOW_UP_TEMPLATE: 'serveq_follow_up',
    WHATSAPP_GRAPH_API_VERSION: 'v27.0',
  };
  const send = configuredWhatsAppSender(environment, async (url, options) => {
    assert.equal(url, 'https://graph.facebook.com/v27.0/123456/messages');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.deepEqual(JSON.parse(options.body), {
      messaging_product: 'whatsapp',
      to: '919876543210',
      type: 'template',
      template: { name: 'serveq_follow_up', language: { code: 'en_US' } },
    });
    return new Response('', { status: 200 });
  });
  await send('+919876543210');
  const rejected = configuredWhatsAppSender(environment, async () => new Response('private provider response', { status: 400 }));
  await assert.rejects(rejected('+919876543210'), { status: 400, message: 'WhatsApp message rejected' });
});
