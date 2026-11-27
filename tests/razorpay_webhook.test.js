import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import paymentRoutes from '../src/modules/payment/payment.routes.js';
import Booking from '../src/booking/booking.model.js';
import User from '../src/modules/auth/auth.model.js';
import Business from '../src/modules/business/business.model.js';
import SubscriptionOrder from '../src/modules/subscription/subscription-order.model.js';
import { getRazorpayClient, processWebhookEvent } from '../src/modules/payment/razorpay.service.js';
import { verifySubscriptionPayment } from '../src/modules/subscription/subscription.service.js';

test('signed Razorpay subscription webhook integration', async t => {
  const secret = 'webhook-integration-secret';
  const names = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  process.env.RAZORPAY_KEY_ID = 'rzp_test_webhookIntegration';
  process.env.RAZORPAY_KEY_SECRET = 'checkout-secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  let purchase;
  let user;
  let payment;
  let syncFails = false;
  let activations = 0;
  let sequence = 0;
  const reset = () => {
    sequence++;
    purchase = { _id: 'purchase', orderId: `order_webhook${sequence}`, owner: 'owner', plan: 'BASIC', amount: 99900 };
    user = { _id: 'owner', role: 'owner', subscription: {}, save: async () => {} };
    payment = { id: `pay_webhook${sequence}`, order_id: purchase.orderId, status: 'captured', amount: 99900, currency: 'INR' };
    syncFails = false;
    activations = 0;
  };
  const event = (type = 'payment.captured') => ({
    event: type,
    payload: {
      payment: { entity: { ...payment } },
      ...(type === 'order.paid' ? { order: { entity: {
        id: purchase.orderId, status: 'paid', amount: purchase.amount, amount_paid: purchase.amount, currency: 'INR',
      } } } : {}),
    },
  });
  t.mock.method(Booking, 'findOne', async () => null);
  const lookup = t.mock.method(SubscriptionOrder, 'findOne', async query =>
    purchase && query.orderId === purchase.orderId && (!query.owner || query.owner === user._id) ? purchase : null);
  t.mock.method(SubscriptionOrder, 'findOneAndUpdate', async (_query, update) => {
    if (purchase.activatedAt) return null;
    activations++;
    Object.assign(purchase, update.$set);
    return purchase;
  });
  t.mock.method(SubscriptionOrder, 'findById', async () => purchase);
  t.mock.method(User, 'findById', async () => user);
  const sync = t.mock.method(Business, 'updateMany', async () => {
    if (syncFails) throw new Error('database unavailable');
  });
  t.mock.method(getRazorpayClient().payments, 'fetch', async () => payment);

  const app = express();
  app.use(express.json({ verify: (req, _res, bytes) => { req.rawBody = bytes; } }));
  app.use('/api/payments', paymentRoutes);
  app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ message: err.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = async (payload, id = crypto.randomUUID(), signingSecret = secret) => {
    const body = JSON.stringify(payload, null, 2);
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/payments/webhook`, {
      method: 'POST', headers: {
        'content-type': 'application/json', 'x-razorpay-event-id': id,
        'x-razorpay-signature': crypto.createHmac('sha256', signingSecret).update(body).digest('hex'),
      }, body,
    });
    return { status: response.status, body: await response.json() };
  };

  await t.test('activates without a browser session and deduplicates the provider event ID', async () => {
    reset();
    const id = crypto.randomUUID();
    assert.equal((await post(event(), id, 'wrong-secret')).status, 400);
    assert.equal(lookup.mock.callCount(), 0);
    const result = await post(event(), id);
    assert.equal(result.status, 200);
    assert.equal(result.body.result.subscriptionOrderId, purchase.orderId);
    assert.equal(user.subscription.status, 'ACTIVE');
    assert.equal(sync.mock.calls.at(-1).arguments[1].$set['subscription.plan'], 'BASIC');
    assert.equal((await post(event(), id)).body.result.status, 'ignored_duplicate');
    assert.equal(activations, 1);
  });

  await t.test('capture, order.paid and Checkout callback share one entitlement', async () => {
    reset();
    assert.equal((await post(event('order.paid'))).status, 200);
    const expiry = +user.subscription.expiresAt;
    assert.equal((await post(event())).status, 200);
    const result = await verifySubscriptionPayment(user._id, {
      plan: purchase.plan, razorpayOrderId: purchase.orderId, razorpayPaymentId: payment.id,
      razorpaySignature: crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${purchase.orderId}|${payment.id}`).digest('hex'),
    });
    assert.equal(+result.subscription.expiresAt, expiry);
    assert.equal(activations, 1);
  });

  await t.test('uses stored purchase pricing and preserves remaining renewal days', async () => {
    reset();
    purchase.amount = 79900;
    payment.amount = 79900;
    const expiry = Date.now() + 86400000;
    user.subscription = { plan: 'BASIC', status: 'ACTIVE', expiresAt: new Date(expiry) };
    assert.equal((await post(event())).status, 200);
    assert.equal(+user.subscription.expiresAt, expiry + 30 * 86400000);
    assert.equal(user.subscription.amount, 799);
  });

  await t.test('accepts a signed Pro payment at the new price', async () => {
    reset();
    purchase.plan = 'PRO';
    purchase.amount = 199900;
    payment.amount = 199900;
    assert.equal((await post(event('order.paid'))).status, 200);
    assert.equal(user.subscription.plan, 'PRO');
    assert.equal(user.subscription.amount, 1999);
  });

  await t.test('rejects wrong capture details, owner notes, plan notes and partially paid orders', async () => {
    reset();
    for (const extra of [
      { amount: 1 }, { currency: 'USD' }, { status: 'authorized' }, { id: 'pay_mock_fake' },
      { notes: { userId: 'another-owner' } }, { notes: { plan: 'PRO' } },
    ]) {
      const payload = event();
      Object.assign(payload.payload.payment.entity, extra);
      assert.equal((await post(payload)).status, 400);
    }
    const payload = event('order.paid');
    payload.payload.order.entity.amount_paid = 1;
    assert.equal((await post(payload)).status, 400);
    assert.equal(activations, 0);
  });

  await t.test('returns an error for failed persistence and completes a retry without extending twice', async () => {
    reset();
    const id = crypto.randomUUID();
    syncFails = true;
    assert.equal((await post(event(), id)).status, 500);
    const expiry = +user.subscription.expiresAt;
    syncFails = false;
    assert.equal((await post(event(), id)).status, 200);
    assert.equal(+user.subscription.expiresAt, expiry);
    assert.equal(activations, 1);
  });

  await t.test('coalesces simultaneous delivery retries', async () => {
    reset();
    const payload = event();
    const id = crypto.randomUUID();
    await Promise.all([processWebhookEvent(payload, null, id), processWebhookEvent(payload, null, id)]);
    assert.equal(activations, 1);
  });

  await t.test('late captures and failed attempts do not overwrite a newer plan', async () => {
    reset();
    assert.equal((await post(event())).status, 200);
    const newer = { plan: 'PRO', status: 'ACTIVE', activatedAt: new Date(Date.now() + 1000), expiresAt: new Date(Date.now() + 86400000) };
    user.subscription = newer;
    assert.equal((await post(event())).status, 200);
    payment.status = 'failed';
    assert.equal((await post(event('payment.failed'))).status, 200);
    assert.equal(user.subscription, newer);
  });

  await t.test('requests redelivery when a subscription capture races order persistence', async () => {
    reset();
    const payload = event();
    payload.payload.payment.entity.notes = { type: 'SERVEQ_BUSINESS_SUBSCRIPTION' };
    const saved = purchase;
    purchase = null;
    const id = crypto.randomUUID();
    assert.equal((await post(payload, id)).status, 503);
    purchase = saved;
    assert.equal((await post(payload, id)).status, 200);
    assert.equal(activations, 1);
  });
});
