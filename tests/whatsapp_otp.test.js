import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createRedisRateLimitStore } from '../src/gateway/rateLimitStore.js';
import { createWhatsAppOtpStore } from '../src/modules/whatsapp/whatsapp-otp.store.js';
import { createPhoneVerification } from '../src/modules/auth/phone-verification.service.js';
import { whatsappConfig } from '../src/modules/whatsapp/whatsapp.config.js';
import { createWhatsAppClient } from '../src/modules/whatsapp/whatsapp.client.js';

const phone = '+919876543210';
const config = {
  otpSecret: randomBytes(32).toString('hex'), cooldown: 60, ttl: 300, maxAttempts: 5,
  dailyLimit: 30, globalLimit: 30, phoneLimit: 2, accountLimit: 4, ipLimit: 3,
};

test('WhatsApp configuration is disabled by default and rejects incomplete or unsafe production settings', () => {
  assert.deepEqual(whatsappConfig({}), { enabled: false, workerEnabled: false });
  assert.throws(() => whatsappConfig({ WHATSAPP_ENABLED: 'yes' }), /Invalid WHATSAPP_ENABLED/);
  assert.throws(() => whatsappConfig({ WHATSAPP_NOTIFICATION_WORKER_ENABLED: 'true' }), /Enable WhatsApp/);
  assert.throws(() => whatsappConfig({ WHATSAPP_ENABLED: 'true' }), /WHATSAPP_ACCESS_TOKEN/);
});

test('Meta receives validated template parameters, opaque IDs and no prescription content', async () => {
  const requests = [];
  const provider = createWhatsAppClient({
    graphVersion: 'v26.0', phoneNumberId: '1', accessToken: 'test-only',
    otpTemplate: 'serveq_phone_otp', documentTemplate: 'serveq_document_ready', language: 'en',
  }, async (url, request) => {
    requests.push({ url, ...request, body: JSON.parse(request.body) });
    return Response.json({ messages: [{ id: 'wamid.test' }] });
  });
  const id = randomUUID();
  assert.throws(() => provider.otp(phone, '123', id), { outcome: 'permanent' });
  await assert.rejects(provider.document(phone, 'patient-id'), { outcome: 'permanent' });
  assert.equal(await provider.otp(phone, '012345', id), 'wamid.test');
  assert.equal(requests[0].body.template.components[1].parameters[0].text, '012345');
  assert.equal(requests[0].redirect, 'error');
  await provider.document(phone, id);
  assert.deepEqual(requests[1].body, {
    messaging_product: 'whatsapp', to: '919876543210', type: 'template', biz_opaque_callback_data: id,
    template: { name: 'serveq_document_ready', language: { code: 'en' } },
  });
  const rejected = createWhatsAppClient({}, async () => new Response('secret token & number', { status: 429 }));
  await assert.rejects(rejected.document(phone, id), { outcome: 'retry', message: 'WhatsApp message could not be confirmed' });
  const timedOut = createWhatsAppClient({}, async () => { throw new Error('012345 private phone and token'); });
  await assert.rejects(timedOut.otp(phone, '012345', id), { outcome: 'unknown', message: 'WhatsApp message could not be confirmed' });
});

test('OTP storage outages fail closed without writing an account or contacting Meta', async () => {
  let calls = 0;
  const service = createPhoneVerification({
    config,
    store: {
      digest: () => 'mock-digest',
      reserve: async () => { throw new Error('private connection details'); },
      read: async () => { throw new Error('private connection details'); },
    },
    provider: { otp: async () => { calls++; } },
    users: { findOneAndUpdate: async () => { calls++; } },
  });
  const scope = { user: { _id: 'test-account' }, phone, session: 'test-session', ip: 'test-ip' };
  const unavailable = { statusCode: 503, message: 'Phone verification is temporarily unavailable.' };
  await assert.rejects(service.send(scope), unavailable);
  await assert.rejects(service.verify({ ...scope, purpose: 'registration', challengeId: randomUUID(), otp: '123456' }), unavailable);
  assert.equal(calls, 0);
});

const redisUrl = process.env.RATE_LIMIT_TEST_REDIS_URL;
test('real Redis applies cooldown, purpose and session binding, atomic attempts, expiry and daily limits', { skip: !redisUrl }, async t => {
  const url = new URL(redisUrl);
  url.pathname = '/14';
  const redis = createRedisRateLimitStore(url.toString());
  await redis.connect();
  t.after(() => redis.close());
  const marker = randomUUID();
  const prefix = `test:{whatsapp-${marker}}`;
  const store = createWhatsAppOtpStore(redis, config, prefix);
  const captured = new Map();
  const associated = [];
  const provider = { otp: async (_phone, code, id) => { captured.set(id, code); return 'wamid.test'; } };
  const deliveries = { beginDelivery: async () => {}, markDeliveryRejected: async () => {}, recordDelivery: async () => {} };
  const users = {
    findOneAndUpdate: async (filter, update) => {
      associated.push({ filter, update });
      return { _id: filter._id, role: 'customer', ...update.$set };
    },
  };
  const service = createPhoneVerification({ config, store, provider, deliveries, users });
  const account = (label, target = phone) => ({
    user: { _id: `${marker}-${label}`, role: 'customer' }, phone: target,
    session: `${marker}-session-${label}`, ip: `${marker}-ip-${label}`, authTime: Date.now() / 1000,
  });
  const purge = input => redis.execute(client => client.sendCommand([
    'DEL',
    `${prefix}:challenge:${store.digest('account', input.user._id)}`,
    `${prefix}:cooldown:${store.digest('account', input.user._id)}`,
    `${prefix}:cooldown:${store.digest('phone', input.phone)}`,
  ]));
  const first = account('first');
  const sent = await service.send(first);
  assert.match(captured.get(sent.challengeId), /^\d{6}$/);
  const stored = await store.read(first.user._id);
  assert.match(stored.proof, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(stored).sort(), ['attempts', 'id', 'proof']);
  await assert.rejects(service.send(first), { statusCode: 429 });
  const valid = { ...first, ...sent, otp: captured.get(sent.challengeId) };
  await assert.rejects(service.verify({ ...valid, purpose: 'phone_change' }), { statusCode: 400 });
  await assert.rejects(service.verify({ ...valid, session: 'other-session' }), { statusCode: 400 });
  await assert.rejects(service.verify({ ...valid, user: { _id: 'other-account' } }), { statusCode: 400 });
  const attempts = await Promise.allSettled([service.verify(valid), service.verify(valid), service.verify(valid)]);
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(associated[0].filter._id, first.user._id);
  assert.equal(attempts.find(result => result.status === 'fulfilled').value.user.phoneVerificationMethod, 'whatsapp');
  assert.ok(attempts.find(result => result.status === 'fulfilled').value.user.whatsappVerifiedAt);
  await assert.rejects(service.verify(valid), { statusCode: 400 });
  await purge(first);

  const second = account('second');
  const issued = await service.send(second);
  const right = captured.get(issued.challengeId);
  const wrong = right === '000000' ? '111111' : '000000';
  const wrongAttempts = await Promise.allSettled(Array.from({ length: 5 }, () => service.verify({ ...second, ...issued, otp: wrong })));
  assert.ok(wrongAttempts.every(result => result.status === 'rejected' && result.reason.statusCode === 400));
  await assert.rejects(service.verify({ ...second, ...issued, otp: right }), { statusCode: 400 });
  await purge(second);
  await assert.rejects(service.send(account('third')), { statusCode: 429 });

  const last = account('last', '+919876543211');
  const legacy = { ...last.user, phone, isPhoneVerified: true, phoneVerification: { provider: 'firebase', phone, verifiedAt: new Date() } };
  await assert.rejects(service.send({ ...last, authTime: 0, user: legacy }), { statusCode: 403 });
  const expiring = await service.send(last);
  const key = `${prefix}:challenge:${store.digest('account', last.user._id)}`;
  await redis.execute(client => client.pExpire(key, 1));
  await delay(30);
  await assert.rejects(service.verify({ ...last, ...expiring, otp: captured.get(expiring.challengeId) }), { statusCode: 400 });
  await purge(last);
  assert.equal(associated.length, 1);
});
