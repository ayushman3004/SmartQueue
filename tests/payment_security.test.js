import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import Booking from '../src/booking/booking.model.js';
import Business from '../src/modules/business/business.model.js';
import SubscriptionOrder from '../src/modules/subscription/subscription-order.model.js';
import { MockPaymentProvider, getPaymentProvider } from '../src/modules/payment/payment.provider.js';
import { handleWebhook } from '../src/modules/payment/payment.controller.js';
import { getRazorpayClient, verifyPaymentSignature, verifyWebhookSignature, confirmRazorpayPaymentForBooking, createRazorpayOrderForBooking, connectRazorpayRouteAccount, processWebhookEvent } from '../src/modules/payment/razorpay.service.js';

const secret = 'securityRegressionSecret';
const sign = value => crypto.createHmac('sha256', secret).update(value).digest('hex');
const booking = (extra = {}) => ({ _id: 'bookingSecurity', userId: 'customer', businessId: 'business', amount: 125, currency: 'INR', razorpayOrderId: 'order_security', razorpayOrderAmount: 12500, status: 'pending_payment', paymentStatus: 'pending', save: async () => {}, ...extra });
const captured = (id, extra = {}) => ({ event: 'payment.captured', created_at: 123, payload: { payment: { entity: { id: `pay_${id}`, order_id: `order_${id}`, amount: 12500, currency: 'INR', status: 'captured', ...extra } } } });

test('production payment security regressions', async t => {
  t.mock.method(SubscriptionOrder, 'findOne', async () => null);
  const names = ['NODE_ENV', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } });
  process.env.NODE_ENV = 'production';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_securityRegression';
  process.env.RAZORPAY_KEY_SECRET = secret;
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;

  await t.test('mock and sentinel signatures never verify, even with configured keys', () => {
    for (const signature of ['sig_verified', 'mock_signature_verified', {}, [], 'z'.repeat(64)]) {
      assert.equal(verifyPaymentSignature({ razorpayOrderId: 'order_security', razorpayPaymentId: 'pay_security', razorpaySignature: signature }), false);
    }
    for (const [order, payment] of [['order_mock_fake', 'pay_security'], ['order_security', 'pay_mock_fake']]) {
      assert.equal(verifyPaymentSignature({ razorpayOrderId: order, razorpayPaymentId: payment, razorpaySignature: sign(`${order}|${payment}`) }), false);
    }
    assert.throws(() => new MockPaymentProvider(), { statusCode: 503 });
    assert.throws(() => getPaymentProvider(), { statusCode: 503 });
    process.env.NODE_ENV = 'test';
    const mock = new MockPaymentProvider();
    process.env.NODE_ENV = 'production';
    return assert.rejects(mock.verifyPayment({}), { statusCode: 503 });
  });

  await t.test('missing credentials cannot create fake orders or activate fake accounts', async t => {
    delete process.env.RAZORPAY_KEY_SECRET;
    t.after(() => { process.env.RAZORPAY_KEY_SECRET = secret; });
    const business = { _id: 'business', paymentConfiguration: { onlinePaymentStatus: 'ACTIVE', paymentMode: 'BOTH', providerAccountReference: 'acc_real' }, save: t.mock.fn() };
    const doc = booking({ businessId: business, save: t.mock.fn() });
    t.mock.method(Booking, 'findById', () => ({ populate: async () => doc }));
    t.mock.method(Business, 'findById', async () => business);
    assert.throws(() => verifyPaymentSignature({ razorpayOrderId: 'order_security', razorpayPaymentId: 'pay_security', razorpaySignature: 'sig_verified' }), { statusCode: 503 });
    await assert.rejects(createRazorpayOrderForBooking('bookingSecurity', 'customer'), { statusCode: 503 });
    await assert.rejects(connectRazorpayRouteAccount('business', {}, {}), { statusCode: 503 });
    assert.equal(doc.save.mock.callCount(), 0);
    assert.equal(business.save.mock.callCount(), 0);
  });

  await t.test('checkout binds signatures, captured amount and currency to the stored order', async t => {
    const doc = booking({ save: t.mock.fn(async () => {}) });
    const callback = { razorpayOrderId: 'order_security', razorpayPaymentId: 'pay_security', razorpaySignature: sign('order_security|pay_security') };
    const payment = { id: 'pay_security', order_id: 'order_security', amount: 12500, currency: 'INR', status: 'captured' };
    t.mock.method(getRazorpayClient().payments, 'fetch', async () => payment);
    await assert.rejects(confirmRazorpayPaymentForBooking(doc, { ...callback, razorpayOrderId: 'order_other' }), { statusCode: 400 });
    for (const [field, bad] of [['amount', 1], ['currency', 'USD'], ['status', 'authorized'], ['order_id', 'order_other']]) {
      const original = payment[field]; payment[field] = bad;
      await assert.rejects(confirmRazorpayPaymentForBooking(doc, callback), { statusCode: 409 });
      payment[field] = original;
    }
    assert.equal(doc.save.mock.callCount(), 0);
    assert.equal(await confirmRazorpayPaymentForBooking(doc, callback), true);
    assert.equal(doc.paymentStatus, 'paid');
    assert.equal(await confirmRazorpayPaymentForBooking(doc, callback), false);
    await assert.rejects(confirmRazorpayPaymentForBooking(doc, { ...callback, razorpaySignature: 'sig_verified' }), { statusCode: 400 });
    assert.equal(doc.paymentStatus, 'paid');
    assert.equal(doc.save.mock.callCount(), 1);
  });

  await t.test('linked accounts require provider verification and preserve pending status', async t => {
    const business = { _id: 'business', paymentConfiguration: {}, save: t.mock.fn(async () => {}) };
    t.mock.method(Business, 'findById', async () => business);
    t.mock.method(getRazorpayClient().accounts, 'fetch', async id => ({ id, status: 'created' }));
    await assert.rejects(connectRazorpayRouteAccount('business', {}, { accountId: 'acc_mock_fake' }), { statusCode: 400 });
    const result = await connectRazorpayRouteAccount('business', {}, { accountId: 'acc_real' });
    assert.equal(result.status, 'PENDING_VERIFICATION');
  });

  await t.test('provider failures and fake provider responses never persist orders', async t => {
    const business = { _id: 'business', name: 'Venue', paymentConfiguration: { onlinePaymentStatus: 'ACTIVE', paymentMode: 'BOTH', providerAccountReference: 'acc_real' } };
    const doc = booking({ businessId: business, save: t.mock.fn(async () => {}) });
    t.mock.method(Booking, 'findById', () => ({ populate: async () => doc }));
    const create = t.mock.method(getRazorpayClient().orders, 'create', async () => { throw new Error('provider unavailable'); });
    await assert.rejects(createRazorpayOrderForBooking('bookingSecurity', 'customer'), { statusCode: 502 });
    create.mock.mockImplementation(async () => ({ id: 'order_mock_fake', amount: 12500, currency: 'INR' }));
    await assert.rejects(createRazorpayOrderForBooking('bookingSecurity', 'customer'), { statusCode: 502 });
    assert.equal(doc.save.mock.callCount(), 0);
    create.mock.mockImplementation(async () => ({ id: 'order_real', amount: 12500, currency: 'INR' }));
    assert.equal((await createRazorpayOrderForBooking('bookingSecurity', 'customer')).id, 'order_real');
    assert.equal(doc.razorpayOrderAmount, 12500);
    assert.equal(doc.save.mock.callCount(), 1);
  });

  await t.test('HTTP webhooks reject unsigned, tampered and missing-secret requests before database access', async t => {
    const lookup = t.mock.method(Booking, 'findOne', async () => null);
    const app = express();
    app.use(express.json({ verify: (req, _res, bytes) => { req.rawBody = bytes; } }));
    app.post('/webhook', handleWebhook);
    app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ error: err.message }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/webhook`;
    const raw = '{ "event": "payment.captured", "label": "₹", "payload": {} }';
    const post = (body, signature) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(signature ? { 'x-razorpay-signature': signature } : {}) }, body });
    assert.equal((await post(raw)).status, 400);
    assert.equal((await post(`${raw} `, sign(raw))).status, 400);
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    assert.equal((await post(raw, sign(raw))).status, 503);
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    assert.equal(lookup.mock.callCount(), 0);
    assert.equal((await post(raw, sign(raw))).status, 200);
    assert.equal(verifyWebhookSignature(raw, sign(raw)), false);
    assert.equal(verifyWebhookSignature(undefined, sign(raw)), false);
  });

  await t.test('webhooks bind orders and amounts, preserve terminal bookings and retry failed saves', async t => {
    let doc = booking({ razorpayOrderId: 'order_webhookA', save: t.mock.fn(async () => {}) });
    const lookup = t.mock.method(Booking, 'findOne', async query => query.razorpayOrderId === doc.razorpayOrderId ? doc : null);
    await assert.rejects(processWebhookEvent(captured('webhookA', { amount: 1 })), { statusCode: 400 });
    await assert.rejects(processWebhookEvent(captured('webhookA', { notes: { bookingId: 'otherBooking' } })), { statusCode: 400 });
    assert.equal((await processWebhookEvent(captured('unknown', { notes: { bookingId: doc._id } }))).status, 'no_matching_booking');
    assert.equal(doc.save.mock.callCount(), 0);
    doc.status = 'cancelled';
    assert.equal((await processWebhookEvent(captured('webhookA'))).status, 'ignored_terminal_booking');
    doc = booking({ razorpayOrderId: 'order_retry', save: async () => { throw new Error('database unavailable'); } });
    const retry = captured('retry');
    await assert.rejects(processWebhookEvent(retry), /database unavailable/);
    doc = booking({ razorpayOrderId: 'order_retry', save: t.mock.fn(async () => {}) });
    assert.equal((await processWebhookEvent(retry)).status, 'processed');
    assert.equal(doc.save.mock.callCount(), 1);
    assert.equal((await processWebhookEvent(retry)).status, 'ignored_duplicate');
    doc = booking({ razorpayOrderId: 'order_sameTimestamp', save: t.mock.fn(async () => {}) });
    assert.equal((await processWebhookEvent(captured('sameTimestamp'))).status, 'processed');
    assert.equal(doc.paymentStatus, 'paid');
    assert.ok(lookup.mock.callCount() >= 6);
  });
});
