import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../src/modules/auth/auth.model.js';
import Business from '../src/modules/business/business.model.js';
import SubscriptionCoupon from '../src/modules/subscription/subscription-coupon.model.js';
import adminRoutes from '../src/modules/admin/admin.routes.js';
import subscriptionRoutes from '../src/modules/subscription/subscription.routes.js';
import { issueBusinessSubscriptionCoupon, redeemBusinessSubscriptionCoupon } from '../src/modules/subscription/subscription-coupon.service.js';
import { isBusinessSubscriptionActive } from '../src/modules/subscription/subscription.service.js';
import { getRazorpayClient } from '../src/modules/payment/razorpay.service.js';

const ownerId = '111111111111111111111111', adminId = '222222222222222222222222';
const businessId = '333333333333333333333333', otherId = '444444444444444444444444';
const DAY = 86400000;
const query = value => ({ session: async () => value, select: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
const equal = (a, b) => b == null ? a == null : a instanceof Date || b instanceof Date ? new Date(a).getTime() === new Date(b).getTime() : String(a) === String(b);
function matches(document, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$and') return value.every(part => matches(document, part));
    if (key === '$or') return value.some(part => matches(document, part));
    if (value && typeof value === 'object' && !(value instanceof Date)) return Object.entries(value).every(([operator, target]) => operator === '$lte' ? document[key] <= target : operator === '$gt' ? document[key] > target : false);
    return equal(document[key], value);
  });
}
function fixture(t) {
  const keys = ['JWT_SECRET', 'RESEND_API_KEY', 'CLIENT_URL', 'SMTP_USER', 'EMAIL_USER', 'GMAIL_USER', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const key of keys) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; } });
  Object.assign(process.env, { JWT_SECRET: 'coupon-tests-only', RESEND_API_KEY: 'coupon-tests-only', CLIENT_URL: 'https://serveq.tech', RAZORPAY_KEY_ID: 'rzp_live_couponTests', RAZORPAY_KEY_SECRET: 'coupon-tests-only' });
  for (const key of ['SMTP_USER', 'EMAIL_USER', 'GMAIL_USER']) delete process.env[key];
  const store = {
    users: [{ _id: ownerId, name: 'Owner', email: 'owner@example.com', role: 'owner', tokenVersion: 0, isEmailVerified: true, subscription: { plan: 'NONE', status: 'INACTIVE' } }, { _id: adminId, role: 'admin', tokenVersion: 0 }, { _id: otherId, role: 'customer', tokenVersion: 0 }],
    businesses: [{ _id: businessId, name: 'Jalandhar Clinic', email: 'clinic@example.com', owner: ownerId, approvalStatus: 'approved', subscription: { plan: 'NONE', status: 'INACTIVE' } }],
    coupons: [], messages: [], delivery: true, failBusinessSave: false,
  };
  const orderCreation = t.mock.method(getRazorpayClient().orders, 'create', async () => { throw new Error('Free coupons must not create a payment order'); });
  const nativeFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails', 'unexpected outbound request');
    store.messages.push(JSON.parse(options.body));
    return { ok: store.delivery, status: store.delivery ? 200 : 503, json: async () => ({ id: 'email-test-id' }) };
  });
  const document = (collection, value) => value ? Object.assign(structuredClone(value), { save: async function (options) {
    assert.ok(options?.session, 'entitlement saves must use the transaction session');
    if (collection === 'businesses' && store.failBusinessSave) throw new Error('transient database failure');
    const { save: _save, ...data } = this;
    store[collection][store[collection].findIndex(row => row._id === data._id)] = structuredClone(data);
  } }) : null;
  t.mock.method(User, 'findById', id => query(document('users', store.users.find(user => String(user._id) === String(id)))));
  t.mock.method(Business, 'findById', id => query(document('businesses', store.businesses.find(business => String(business._id) === String(id)))));
  t.mock.method(SubscriptionCoupon, 'findOne', filter => query(structuredClone(store.coupons.find(row => matches(row, filter)) || null)));
  t.mock.method(SubscriptionCoupon, 'create', async input => {
    if (store.coupons.some(coupon => coupon.businessId === input.businessId || coupon.code === input.code)) throw Object.assign(new Error('duplicate coupon'), { code: 11000 });
    const coupon = { _id: '555555555555555555555555', status: 'ISSUED', emailStatus: 'PENDING', emailLeaseUntil: null, lastEmailAttemptAt: null, ...input };
    store.coupons.push(structuredClone(coupon));
    return structuredClone(coupon);
  });
  t.mock.method(SubscriptionCoupon, 'findOneAndUpdate', async (filter, update, options) => {
    if (update.$set.status === 'REDEEMED') assert.ok(options.session);
    const coupon = store.coupons.find(row => matches(row, filter));
    if (!coupon) return null;
    Object.assign(coupon, structuredClone(update.$set));
    return structuredClone(coupon);
  });
  // A deterministic transactional store exercises rollback and concurrent callers.
  // Database uniqueness and transaction support are deployment requirements.
  let tail = Promise.resolve();
  t.mock.method(mongoose, 'startSession', async () => ({
    withTransaction: async callback => {
      const previous = tail;
      let unlock;
      tail = new Promise(resolve => { unlock = resolve; });
      await previous;
      const snapshot = structuredClone({ users: store.users, businesses: store.businesses, coupons: store.coupons });
      try { await callback(); }
      catch (error) { Object.assign(store, snapshot); throw error; }
      finally { unlock(); }
    }, endSession: async () => {},
  }));
  t.after(() => assert.equal(orderCreation.mock.callCount(), 0));
  return { store, nativeFetch };
}

test('admin creates a named, business-bound Pro coupon and emails the real business address', async t => {
  const { store } = fixture(t);
  const result = await issueBusinessSubscriptionCoupon(businessId, adminId);
  assert.equal(result.emailSent, true);
  assert.match(result.coupon.code, /^JALANDHAR-CLINIC-PRO-[A-F0-9]{12}$/);
  assert.equal(result.coupon.plan, 'PRO');
  assert.equal(result.coupon.durationDays, 30);
  assert.equal(result.coupon.status, 'ISSUED');
  assert.deepEqual(store.messages[0].to, ['clinic@example.com']);
  assert.ok(store.messages[0].text.includes(result.coupon.code));
  assert.ok(store.messages[0].html.includes('https://serveq.tech/subscription'));
  assert.match(store.messages[0].text, /No card, Razorpay payment, or automatic renewal/);
  assert.equal(store.users[0].subscription.status, 'INACTIVE');
  assert.equal(store.coupons[0].createdBy, adminId);
  assert.ok(SubscriptionCoupon.schema.indexes().some(([fields, options]) => fields.businessId === 1 && options.unique));
});

test('duplicate generation clicks reuse one coupon and cannot send duplicate concurrent emails', async t => {
  const { store } = fixture(t);
  const results = await Promise.allSettled([issueBusinessSubscriptionCoupon(businessId, adminId), issueBusinessSubscriptionCoupon(businessId, adminId)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(store.coupons.length, 1);
  assert.equal(store.messages.length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 429);
});

test('failed email is visible and resending preserves the same single-use coupon', async t => {
  const { store } = fixture(t);
  store.delivery = false;
  const first = await issueBusinessSubscriptionCoupon(businessId, adminId);
  assert.equal(first.emailSent, false);
  assert.equal(first.coupon.emailStatus, 'FAILED');
  store.delivery = true;
  store.coupons[0].lastEmailAttemptAt = new Date(Date.now() - 61000);
  const retry = await issueBusinessSubscriptionCoupon(businessId, adminId);
  assert.equal(retry.emailSent, true);
  assert.equal(retry.coupon.code, first.coupon.code);
  assert.equal(store.coupons.length, 1);
});

test('redemption grants exactly 30 free Pro days once and only for the intended business', async t => {
  const { store } = fixture(t);
  const issued = await issueBusinessSubscriptionCoupon(businessId, adminId);
  const before = Date.now();
  const result = await redeemBusinessSubscriptionCoupon(ownerId, issued.coupon.code.toLowerCase());
  assert.equal(result.subscription.plan, 'PRO');
  assert.equal(result.subscription.amount, 0);
  assert.equal(result.subscription.businessId, businessId);
  assert.equal(new Date(result.subscription.expiresAt) - new Date(result.subscription.activatedAt), 30 * DAY);
  assert.ok(new Date(result.subscription.activatedAt).getTime() >= before);
  assert.equal(store.businesses[0].subscription.plan, 'PRO');
  const expiry = store.users[0].subscription.expiresAt;
  await assert.rejects(redeemBusinessSubscriptionCoupon(ownerId, issued.coupon.code), { statusCode: 409 });
  assert.deepEqual(store.users[0].subscription.expiresAt, expiry);
  await assert.rejects(issueBusinessSubscriptionCoupon(businessId, adminId), { statusCode: 409 });
  assert.equal(store.coupons.length, 1);
  const foreign = { _id: '999999999999999999999999', owner: ownerId, subscription: { status: 'INACTIVE', plan: 'NONE' } };
  assert.equal(await isBusinessSubscriptionActive(foreign), false);
  assert.equal(await isBusinessSubscriptionActive(store.businesses[0]), true);
});

test('concurrent redemption activates only once', async t => {
  const { store } = fixture(t);
  const { coupon } = await issueBusinessSubscriptionCoupon(businessId, adminId);
  const results = await Promise.allSettled([redeemBusinessSubscriptionCoupon(ownerId, coupon.code), redeemBusinessSubscriptionCoupon(ownerId, coupon.code)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 409);
  assert.equal(store.coupons[0].status, 'REDEEMED');
  assert.equal(new Date(store.users[0].subscription.expiresAt) - new Date(store.users[0].subscription.activatedAt), 30 * DAY);
});

test('a failed entitlement write rolls back coupon consumption and can be retried safely', async t => {
  const { store } = fixture(t);
  const { coupon } = await issueBusinessSubscriptionCoupon(businessId, adminId);
  store.failBusinessSave = true;
  await assert.rejects(redeemBusinessSubscriptionCoupon(ownerId, coupon.code), /transient database failure/);
  assert.equal(store.coupons[0].status, 'ISSUED');
  assert.equal(store.users[0].subscription.status, 'INACTIVE');
  store.failBusinessSave = false;
  await redeemBusinessSubscriptionCoupon(ownerId, coupon.code);
  assert.equal(store.coupons[0].status, 'REDEEMED');
});

test('wrong owners, expired coupons, ownership changes and active paid subscriptions cannot consume a coupon', async t => {
  const { store } = fixture(t);
  const { coupon } = await issueBusinessSubscriptionCoupon(businessId, adminId);
  await assert.rejects(redeemBusinessSubscriptionCoupon(otherId, coupon.code), { statusCode: 403 });
  const expires = store.coupons[0].redeemBy;
  store.coupons[0].redeemBy = new Date(Date.now() - 1);
  await assert.rejects(redeemBusinessSubscriptionCoupon(ownerId, coupon.code), { statusCode: 409 });
  store.coupons[0].redeemBy = expires;
  store.businesses[0].owner = otherId;
  await assert.rejects(redeemBusinessSubscriptionCoupon(ownerId, coupon.code), { statusCode: 403 });
  store.businesses[0].owner = ownerId;
  store.users[0].subscription = { plan: 'BASIC', status: 'ACTIVE', amount: 799, expiresAt: new Date(Date.now() + DAY) };
  await assert.rejects(redeemBusinessSubscriptionCoupon(ownerId, coupon.code), { statusCode: 409 });
  assert.equal(store.users[0].subscription.amount, 799);
  assert.equal(store.coupons[0].status, 'ISSUED');
});

test('invalid inputs, missing business email and unapproved businesses fail before issuing coupons', async t => {
  const { store } = fixture(t);
  await assert.rejects(issueBusinessSubscriptionCoupon('bad-id', adminId), { statusCode: 400 });
  for (const input of [null, {}, [], '', 'A'.repeat(65)]) await assert.rejects(redeemBusinessSubscriptionCoupon(ownerId, input), { statusCode: 400 });
  store.businesses[0].email = '';
  await assert.rejects(issueBusinessSubscriptionCoupon(businessId, adminId), { statusCode: 400 });
  store.businesses[0].email = 'clinic@example.com';
  store.businesses[0].approvalStatus = 'suspended';
  await assert.rejects(issueBusinessSubscriptionCoupon(businessId, adminId), { statusCode: 409 });
  assert.equal(store.coupons.length, 0);
  assert.equal(store.messages.length, 0);
});

test('HTTP authorization protects coupon issue, inspection and redemption; request fields cannot change grants', async t => {
  const { store, nativeFetch } = fixture(t);
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = (path, id, body = {}) => nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(id ? { authorization: `Bearer ${jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET)}` } : {}) }, body: JSON.stringify(body),
  });
  const issue = `/api/admin/business/${businessId}/subscription-coupon`;
  assert.equal((await post(issue)).status, 401);
  assert.equal((await post(issue, ownerId)).status, 403);
  assert.equal((await post(issue, otherId)).status, 403);
  assert.equal(store.messages.length, 0);
  const created = await post(issue, adminId, { email: 'attacker@example.com', plan: 'BASIC', durationDays: 9999 });
  assert.equal(created.status, 200);
  assert.equal(created.headers.get('cache-control'), 'no-store');
  const { coupon } = (await created.json()).data;
  assert.equal(coupon.email, 'clinic@example.com');
  assert.equal(coupon.plan, 'PRO');
  assert.equal(coupon.durationDays, 30);
  assert.equal((await post('/api/subscriptions/redeem-coupon', otherId, { code: coupon.code })).status, 403);
  const redeemed = await post('/api/subscriptions/redeem-coupon', ownerId, { code: coupon.code, businessId: otherId, amount: -999, plan: 'BASIC' });
  assert.equal(redeemed.status, 200);
  assert.equal((await redeemed.json()).data.subscription.amount, 0);
  assert.equal((await post('/api/subscriptions/redeem-coupon', ownerId, { code: coupon.code })).status, 409);
});
