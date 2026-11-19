import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/modules/auth/auth.model.js';
import { updateProfile, sanitize } from '../src/modules/auth/auth.service.js';
import { createPhoneVerification } from '../src/modules/auth/phone-verification.service.js';
import { verifyFirebaseIdToken } from '../config/firebase-admin.js';

const phone = '+919876543210';
const proof = () => ({ uid: 'firebase-user', phone_number: phone, auth_time: Math.floor(Date.now() / 1000), firebase: { sign_in_provider: 'phone' } });
const account = () => ({ _id: 'account', email: 'person@example.com', name: 'Person', phone, role: 'customer', walletBalance: 42,
  password: 'stored-hash', googleId: 'original-google-id', authProvider: 'local', tokenVersion: 2,
  isPhoneVerified: true, isEmailVerified: true,
  phoneVerification: { provider: 'firebase', phone, verifiedAt: new Date() },
  subscription: { plan: 'NONE' }, ownerAccess: { status: 'INVITED' }, save: async () => {} });

test('profile updates allowlist editable fields without mutating the request or protected state', async t => {
  const user = account();
  t.mock.method(User, 'findById', async () => user);
  const body = Object.freeze(JSON.parse('{"name":" Updated ","bio":"Hello","role":"admin","walletBalance":999,"password":"hacked","googleId":"new","authProvider":"google","tokenVersion":99,"isPhoneVerified":false,"isEmailVerified":false,"phoneVerification":{"provider":"firebase"},"subscription":{"plan":"PRO"},"ownerAccess":{"status":"ACTIVE"},"_id":"other","__proto__":{"isAdmin":true},"$set":{"role":"admin"},"ownerAccess.status":"ACTIVE"}'));
  const before = structuredClone({ ...user, save: undefined });
  const result = await updateProfile(user._id, body);
  assert.equal(user.name, 'Updated');
  assert.equal(user.bio, 'Hello');
  for (const key of ['role', 'walletBalance', 'password', 'googleId', 'authProvider', 'tokenVersion', 'isPhoneVerified', 'isEmailVerified', 'phoneVerification', 'subscription', 'ownerAccess', '_id']) assert.deepEqual(user[key], before[key], key);
  assert.equal(result.password, undefined);
  assert.equal(result.isPhoneVerified, true);
  assert.equal(body.role, 'admin');
  assert.equal({}.isAdmin, undefined);
});

test('invalid profile fields fail before any account mutation or write', async t => {
  let reads = 0;
  t.mock.method(User, 'findById', async () => { reads++; return account(); });
  for (const body of [null, [], 'string', { phone: {} }, { name: '' }, { email: 'invalid' }, { phone: 'anything' }, { name: 'New name', bio: {} }]) {
    await assert.rejects(updateProfile('account', body), { statusCode: 400 });
  }
  assert.equal(reads, 0);
});

test('changing or clearing a phone invalidates proof; equivalent formatting preserves it', async t => {
  const user = account();
  t.mock.method(User, 'findById', async () => user);
  await updateProfile(user._id, { phone: '98765 43210', isPhoneVerified: true });
  assert.equal(user.phone, phone);
  assert.equal(sanitize(user).isPhoneVerified, true);
  await updateProfile(user._id, { phone: '+919876543211', isPhoneVerified: true });
  assert.equal(user.isPhoneVerified, false);
  assert.equal(user.phoneVerification, undefined);
  await updateProfile(user._id, { phone: '' });
  assert.equal(sanitize(user).isPhoneVerified, false);
});

test('email changes do not inherit verification from the Google provider', async t => {
  const user = { ...account(), authProvider: 'google' };
  t.mock.method(User, 'findById', async () => user);
  t.mock.method(User, 'findOne', async () => null);
  const result = await updateProfile(user._id, { email: 'NEW@example.com', isEmailVerified: true });
  assert.equal(result.email, 'new@example.com');
  assert.equal(result.isEmailVerified, false);
});

test('legacy boolean phone flags without matching server proof are not trusted', () => {
  const user = account();
  delete user.phoneVerification;
  assert.equal(sanitize(user).isPhoneVerified, false);
  user.phoneVerification = { provider: 'firebase', phone: '+919876543211', verifiedAt: new Date() };
  assert.equal(sanitize(user).isPhoneVerified, false);
});

test('phone verification rejects missing, forged, stale, non-phone and mismatched proof before database access', async () => {
  let reads = 0;
  const users = { findById: async () => { reads++; return account(); } };
  const payload = { userId: 'account', phone, idToken: 'token' };
  const verify = createPhoneVerification({ users, verifyToken: async () => proof() });
  for (const token of [undefined, '', {}, 'x'.repeat(8193)]) await assert.rejects(verify({ ...payload, idToken: token }), { statusCode: 400 });
  for (const claims of [null, { ...proof(), phone_number: '+919876543211' }, { ...proof(), firebase: { sign_in_provider: 'password' } }, { ...proof(), auth_time: 0 }, { ...proof(), auth_time: Date.now() / 1000 + 120 }, { ...proof(), auth_time: 'not-a-date' }, { ...proof(), uid: '' }]) {
    await assert.rejects(createPhoneVerification({ users, verifyToken: async () => claims })(payload), { statusCode: 401 });
  }
  await assert.rejects(createPhoneVerification({ users, verifyToken: async () => { throw new Error('forged token'); } })(payload), { statusCode: 401 });
  assert.equal(reads, 0);
});

test('a recent verified Firebase phone claim updates only the authenticated account', async () => {
  const user = account();
  let saved = false;
  let lookup;
  user.save = async () => { saved = true; };
  const verify = createPhoneVerification({ verifyToken: async token => { assert.equal(token, 'verified-token'); return proof(); }, users: { findById: async id => { lookup = id; return user; } } });
  const result = await verify({ userId: 'authenticated-account', phone: '98765-43210', idToken: 'verified-token' });
  assert.equal(lookup, 'authenticated-account');
  assert.equal(saved, true);
  assert.equal(user.phone, phone);
  assert.equal(user.phoneVerification.provider, 'firebase');
  assert.equal(result.user.isPhoneVerified, true);
  assert.equal(result.user.password, undefined);
});

test('real Firebase verifier refuses emulator bypass and unsigned JWTs', async t => {
  const previousHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const previousProject = process.env.FIREBASE_PROJECT_ID;
  const previousAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  t.after(() => {
    for (const [key, value] of Object.entries({ FIREBASE_AUTH_EMULATOR_HOST: previousHost, FIREBASE_PROJECT_ID: previousProject, FIREBASE_SERVICE_ACCOUNT_JSON: previousAccount })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  await assert.rejects(verifyFirebaseIdToken('token'), { statusCode: 503 });
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  process.env.FIREBASE_PROJECT_ID = 'test-phone-project';
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(proof())).toString('base64url');
  await assert.rejects(verifyFirebaseIdToken(`${header}.${payload}.`), { statusCode: 401 });
});
