import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import authRoutes from '../src/modules/auth/auth.routes.js';
import User from '../src/modules/auth/auth.model.js';
import { tokenCookieOptions, setTokenCookie, clearTokenCookie, hashPassword } from '../src/modules/auth.utils.js';
import { OAUTH_STATE_COOKIE, oauthClientUrl } from '../src/modules/auth/oauth-security.js';
import { requireVerifiedEmail } from '../middleware/auth.middleware.js';
import { cookieOriginGuard } from '../middleware/cookie-origin.middleware.js';
import { restoreOAuthSession, logoutBrowserSession, waitForBrowserLogout } from '../src/utils/browserSession.js';

test('OAuth uses browser-bound state and HttpOnly cookie sessions', async t => {
  const names = ['NODE_ENV', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'CLIENT_URL', 'AUTH_COOKIE_SAME_SITE'];
  const old = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => { for (const name of names) { if (old[name] === undefined) delete process.env[name]; else process.env[name] = old[name]; } });
  Object.assign(process.env, { NODE_ENV: 'production', JWT_SECRET: 'oauth-regression-secret', GOOGLE_CLIENT_ID: 'oauth-test-client', GOOGLE_CLIENT_SECRET: 'oauth-test-secret', CLIENT_URL: 'https://serveq.tech' });
  delete process.env.AUTH_COOKIE_SAME_SITE;
  const user = { _id: '111111111111111111111111', role: 'customer', name: 'OAuth Customer', email: 'customer@example.com', tokenVersion: 0, isEmailVerified: true };
  t.mock.method(User, 'findById', id => ({ select: async () => id === user._id ? user : null, then: (resolve, reject) => Promise.resolve(id === user._id ? user : null).then(resolve, reject) }));
  t.mock.method(User, 'updateOne', async (filter, pipeline, options) => {
    assert.deepEqual(filter, { _id: user._id });
    assert.equal(options.updatePipeline, true);
    const [_, sessions] = pipeline[0].$set.revokedSessions.$concatArrays;
    user.revokedSessions = sessions;
  });
  let callbackCount = 0;
  let oauthError = null;
  let callbackRole;
  t.mock.method(passport, 'authenticate', (_strategy, options, callback) => (req, res) => {
    if (!callback) return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?state=${options.state}`);
    callbackCount++;
    callbackRole = req.oauthRole;
    callback(oauthError, oauthError ? null : user);
  });
  const app = express();
  app.use(express.json(), cookieParser(), cookieOriginGuard);
  app.use('/api/auth', authRoutes);
  app.get('/verified', (req, _res, next) => { req.user = user; next(); }, requireVerifiedEmail, (_req, res) => res.sendStatus(204));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(base + path, { redirect: 'manual', ...options });
  const start = async (role = 'customer') => {
    const response = await request(`/api/auth/google?role=${role}`);
    const state = new URL(response.headers.get('location')).searchParams.get('state');
    const cookie = response.headers.getSetCookie().find(value => value.startsWith(`${OAUTH_STATE_COOKIE}=`)).split(';')[0];
    return { response, state, cookie };
  };
  const finish = (state, cookie) => request(`/api/auth/google/callback?code=fake-provider-code&state=${encodeURIComponent(state)}`, { headers: cookie ? { cookie } : {} });

  await t.test('browser startup reports signed-out sessions without changing the protected profile response', async () => {
    const expired = jwt.sign({ id: user._id, exp: 1 }, process.env.JWT_SECRET);
    for (const headers of [{}, { cookie: 'token=invalid' }, { cookie: `token=${expired}` }]) {
      const response = await request('/api/auth/me?optional=1', { headers });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual((await response.json()).data, { user: null });
    }
    assert.equal((await request('/api/auth/me')).status, 401);
  });

  await t.test('OAuth start generates unique state and a short-lived protected cookie', async () => {
    const first = await start('owner');
    const second = await start();
    assert.match(first.state, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(first.state, second.state);
    assert.notEqual(first.state, 'owner');
    const cookie = first.response.headers.getSetCookie()[0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Max-Age=600/);
    assert.match(cookie, /Path=\/api\/auth\/google/);
    assert.equal(first.response.headers.get('cache-control'), 'no-store');
    assert.equal(first.response.headers.get('referrer-policy'), 'no-referrer');
  });

  await t.test('missing, mismatched, forged, expired and malformed state cannot reach Passport', async () => {
    const transaction = await start();
    const before = callbackCount;
    const expired = jwt.sign({ nonce: transaction.state, purpose: 'google-oauth-state', role: 'owner', exp: 1 }, process.env.JWT_SECRET);
    const forged = jwt.sign({ nonce: transaction.state, purpose: 'google-oauth-state' }, 'wrong-secret');
    for (const [state, cookie] of [[transaction.state, null], ['owner', transaction.cookie], ['x'.repeat(43), transaction.cookie], [transaction.state, `${OAUTH_STATE_COOKIE}=${expired}`], [transaction.state, `${OAUTH_STATE_COOKIE}=${forged}`]]) {
      const response = await finish(state, cookie);
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), 'https://serveq.tech/login?error=oauth_state_invalid');
      assert.equal(response.headers.getSetCookie().some(value => value.startsWith('token=')), false);
    }
    const repeated = await request(`/api/auth/google/callback?state=${transaction.state}&state=owner`, { headers: { cookie: transaction.cookie } });
    assert.match(repeated.headers.get('location'), /oauth_state_invalid/);
    assert.equal(callbackCount, before);
  });

  let sessionCookie;
  await t.test('successful callback exposes no JWT in redirect, body or profile response', async () => {
    const transaction = await start('owner');
    const response = await finish(transaction.state, transaction.cookie);
    assert.equal(response.headers.get('location'), 'https://serveq.tech/auth/callback');
    assert.equal(callbackRole, 'owner');
    const cookies = response.headers.getSetCookie();
    const session = cookies.find(value => value.startsWith('token='));
    sessionCookie = session.split(';')[0];
    const rawToken = decodeURIComponent(sessionCookie.slice(6));
    assert.equal(jwt.verify(rawToken, process.env.JWT_SECRET).id, user._id);
    assert.match(session, /HttpOnly/); assert.match(session, /Secure/); assert.match(session, /SameSite=Lax/);
    assert.doesNotMatch(session, /Domain=/i);
    assert.equal((await response.text()).includes(rawToken), false);
    assert.ok(cookies.some(value => value.startsWith(`${OAUTH_STATE_COOKIE}=`) && /Expires=Thu, 01 Jan 1970/.test(value)));
    const profile = await request('/api/auth/me', { headers: { cookie: sessionCookie } });
    assert.equal(profile.status, 200);
    const data = await profile.json();
    assert.equal(data.data.user._id, user._id);
    assert.equal(JSON.stringify(data).includes(rawToken), false);
    const browserSession = await request('/api/auth/me?optional=1', { headers: { cookie: sessionCookie } });
    assert.equal(browserSession.status, 200);
    assert.equal(browserSession.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await browserSession.json()).data, data.data);
    assert.match((await finish(transaction.state)).headers.get('location'), /oauth_state_invalid/);
  });

  await t.test('provider failures redirect with controlled codes and never reflect errors', async () => {
    const transaction = await start('owner');
    oauthError = Object.assign(new Error('sensitive-provider-token'), { statusCode: 403 });
    const response = await finish(transaction.state, transaction.cookie);
    oauthError = null;
    assert.equal(response.headers.get('location'), 'https://serveq.tech/hub/login?error=customer_account_forbidden');
    assert.equal((await response.text()).includes('sensitive-provider-token'), false);
    assert.equal(response.headers.getSetCookie().some(value => value.startsWith('token=')), false);
  });

  await t.test('invalid production frontend configuration fails before provider callback or cookie issuance', async () => {
    const transaction = await start();
    const before = callbackCount;
    process.env.CLIENT_URL = 'http://serveq.tech';
    const response = await finish(transaction.state, transaction.cookie);
    process.env.CLIENT_URL = 'https://serveq.tech';
    assert.equal(response.status, 500);
    assert.equal(callbackCount, before);
    assert.equal(response.headers.getSetCookie().some(value => value.startsWith('token=')), false);
  });

  await t.test('cookie logout rejects foreign origins and clears matching secure attributes', async () => {
    const foreign = await request('/api/auth/logout', { method: 'POST', headers: { cookie: sessionCookie, origin: 'https://attacker.example' } });
    assert.equal(foreign.status, 403);
    const missingOrigin = await request('/api/auth/logout', { method: 'POST', headers: { cookie: sessionCookie } });
    assert.equal(missingOrigin.status, 403);
    const logout = await request('/api/auth/logout', { method: 'POST', headers: { cookie: sessionCookie, origin: 'https://serveq.tech' } });
    assert.equal(logout.status, 200);
    const cookie = logout.headers.get('set-cookie');
    const reusedCookie = await request('/api/auth/me', { headers: { cookie: sessionCookie } });
    assert.equal(reusedCookie.status, 401);
    const signedOutSession = await request('/api/auth/me?optional=1', { headers: { cookie: sessionCookie } });
    assert.equal(signedOutSession.status, 200);
    assert.deepEqual((await signedOutSession.json()).data, { user: null });
    const independent = await start();
    const fresh = await finish(independent.state, independent.cookie);
    const freshSession = fresh.headers.getSetCookie().find(value => value.startsWith('token=')).split(';')[0];
    assert.equal((await request('/api/auth/me', { headers: { cookie: freshSession } })).status, 200);
    assert.match(cookie, /^token=;/); assert.match(cookie, /Secure/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Path=\//);
  });

  await t.test('browser password sign-in issues only a cookie while native sign-in retains bearer support', async () => {
    const password = 'FixturePassword123!';
    user.password = await hashPassword(password);
    t.mock.method(User, 'findOne', () => ({ select: async () => user }));
    const login = extraHeaders => request('/api/auth/signin', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify({ email: user.email, password }),
    });
    const browser = await login({ 'X-ServeQ-Session': 'cookie' });
    assert.equal(browser.status, 200);
    assert.match(browser.headers.get('set-cookie'), /HttpOnly/);
    assert.equal((await browser.json()).data.token, undefined);
    const native = await login();
    assert.equal(native.status, 200);
    assert.equal(jwt.verify((await native.json()).data.token, process.env.JWT_SECRET).id, user._id);
  });

  await t.test('a Google provider label alone cannot satisfy verified-email authorization', async () => {
    user.authProvider = 'google';
    user.isEmailVerified = false;
    assert.equal((await request('/verified')).status, 403);
    user.isEmailVerified = true;
    assert.equal((await request('/verified')).status, 204);
  });

  await t.test('production security cannot be downgraded by insecure or missing proxy headers', () => {
    for (const req of [null, { secure: false, headers: {} }, { secure: false, headers: { 'x-forwarded-proto': 'http' } }]) {
      assert.equal(tokenCookieOptions(req).secure, true);
    }
    for (const mode of ['lax', 'strict', 'none']) {
      process.env.AUTH_COOKIE_SAME_SITE = mode;
      let set, clear;
      const res = { cookie: (_name, _value, options) => { set = options; }, clearCookie: (_name, options) => { clear = options; } };
      setTokenCookie(res, 'test-token'); clearTokenCookie(res);
      delete set.maxAge;
      assert.deepEqual(set, clear);
      assert.equal(set.secure, true);
      assert.equal(set.sameSite, mode);
    }
    process.env.AUTH_COOKIE_SAME_SITE = 'invalid';
    assert.throws(() => tokenCookieOptions());
    delete process.env.AUTH_COOKIE_SAME_SITE;
    process.env.CLIENT_URL = 'http://serveq.tech';
    assert.throws(() => oauthClientUrl('/auth/callback'));
    process.env.CLIENT_URL = 'https://serveq.tech';
  });

  await t.test('development remains usable locally; cross-site cookies always require Secure', () => {
    process.env.NODE_ENV = 'development';
    assert.equal(tokenCookieOptions({ secure: false }).secure, false);
    assert.equal(tokenCookieOptions({ secure: true }).secure, true);
    // Untrusted raw forwarding headers cannot enable weaker cookie settings.
    process.env.AUTH_COOKIE_SAME_SITE = 'none';
    assert.equal(tokenCookieOptions({ secure: false }).secure, true);
    delete process.env.AUTH_COOKIE_SAME_SITE;
    process.env.NODE_ENV = 'production';
  });
});

test('OAuth browser completion uses cookies and removes stale browser bearer credentials', async () => {
  const entries = new Map([['token', 'old-bearer']]);
  const storage = { removeItem: key => entries.delete(key) };
  const user = { _id: 'customer' };
  let finishLogout;
  const api = { defaults: { headers: { common: { Authorization: 'Bearer old-bearer' } } }, get: async path => {
    assert.equal(path, '/auth/me');
    assert.equal(entries.has('token'), false);
    assert.equal(api.defaults.headers.common.Authorization, undefined);
    return { data: { data: { user } } };
  }, post: path => {
    assert.equal(path, '/auth/logout');
    return new Promise(resolve => { finishLogout = resolve; });
  } };
  assert.equal(await restoreOAuthSession(api, storage), user);
  assert.equal(entries.has('token'), false);
  const logout = logoutBrowserSession(api, storage);
  assert.equal(waitForBrowserLogout(), logout);
  let reconnected = false;
  void waitForBrowserLogout().then(() => { reconnected = true; });
  await Promise.resolve();
  assert.equal(reconnected, false);
  finishLogout();
  await logout;
  assert.equal(reconnected, true);
  api.post = async () => { throw new Error('network unavailable'); };
  assert.equal(await logoutBrowserSession(api, storage), false);
});
