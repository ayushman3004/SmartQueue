import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../src/modules/auth/auth.model.js';
import authRoutes from '../src/modules/auth/auth.routes.js';
import { gatewayErrorHandler } from '../src/gateway/gateway.middleware.js';

test('profile and phone HTTP endpoints reject mass assignment and phone-only verification', async t => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'profile-http-test-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  let saves = 0;
  const user = { _id: 'customer', name: 'Customer', email: 'customer@example.com', role: 'customer', phone: '',
    isPhoneVerified: false, isEmailVerified: false, tokenVersion: 0, walletBalance: 20, save: async () => { saves++; } };
  t.mock.method(User, 'findById', () => ({ select: async () => user, then: (resolve, reject) => Promise.resolve(user).then(resolve, reject) }));
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(gatewayErrorHandler);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const token = jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET);
  const request = (path, body, authenticated = true, method = 'POST') => fetch(base + path, {
    method, headers: { 'content-type': 'application/json', ...(authenticated ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
  });
  assert.equal((await request('/me', { role: 'admin' }, false, 'PATCH')).status, 401);
  for (const idToken of [undefined, '', {}]) {
    const res = await request('/phone/verify-firebase', { phone: '+919876543210', idToken, isPhoneVerified: true, userId: 'other-account' });
    assert.equal(res.status, 400);
  }
  assert.equal((await request('/phone/send-otp', { phone: '+919876543210' })).status, 410);
  assert.equal((await request('/phone/verify-otp', { phone: '+919876543210', otp: '123456' })).status, 410);
  assert.equal(saves, 0);
  assert.equal(user.isPhoneVerified, false);

  const response = await request('/me', { name: 'Updated', role: 'admin', password: 'hacked', googleId: 'fake', authProvider: 'google',
    walletBalance: 999, tokenVersion: 9, isPhoneVerified: true, isEmailVerified: true, subscription: { plan: 'PRO' }, ownerAccess: { status: 'ACTIVE' } }, true, 'PATCH');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.user.name, 'Updated');
  assert.equal(body.data.user.role, 'customer');
  assert.equal(body.data.user.walletBalance, 20);
  assert.equal(body.data.user.isPhoneVerified, false);
  assert.equal(user.tokenVersion, 0);
  assert.equal(user.password, undefined);
  assert.equal(user.ownerAccess, undefined);
  assert.equal(user.subscription, undefined);
  assert.equal(user.googleId, undefined);
  assert.equal(saves, 1);
});
