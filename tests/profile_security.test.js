import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/modules/auth/auth.model.js';
import { updateProfile, sanitize } from '../src/modules/auth/auth.service.js';

const phone = '+919876543210';
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
  assert.equal(result.phoneVerificationMethod, 'firebase');
  assert.equal(result.whatsappVerifiedAt, undefined);
  assert.equal(result.whatsappConsent, false);
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
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  await updateProfile(user._id, { phone: '98765 43210', isPhoneVerified: true });
  assert.equal(user.phone, phone);
  assert.equal(sanitize(user).isPhoneVerified, true);
  await assert.rejects(updateProfile(user._id, { phone: '+919876543211' }, 0), { statusCode: 403 });
  await updateProfile(user._id, { phone: '+919876543211', isPhoneVerified: true }, Date.now() / 1000);
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
