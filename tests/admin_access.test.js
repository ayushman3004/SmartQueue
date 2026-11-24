import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { once } from "node:events";
import jwt from "jsonwebtoken";
import User from "../src/modules/auth/auth.model.js";
import Queue from "../src/queue/queue.model.js";
import { generateToken, hashPassword } from "../src/modules/auth.utils.js";

test("Cloudflare identity and the ServeQ administrator account are both required", async t => {
  const team = "fixture.cloudflareaccess.com";
  const audience = "a".repeat(64);
  const email = "admin@example.test";
  const password = "FixturePassword123!";
  Object.assign(process.env, {
    JWT_SECRET: "admin-access-fixture-key",
    CLIENT_URL: "https://www.serveq.tech",
    CLOUDFLARE_ADMIN_ACCESS_TEAM: team,
    CLOUDFLARE_ADMIN_ACCESS_AUD: audience,
    CLOUDFLARE_ADMIN_ACCESS_EMAIL: email,
  });
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const signAccess = (claims = {}) => jwt.sign({
    iss: `https://${team}`, aud: [audience], type: "app", email, sub: "admin-idp",
    exp: Math.floor(Date.now() / 1000) + 120,
    ...claims,
  }, privateKey, { algorithm: "RS256", keyid: "fixture-key" });

  const admin = { _id: "1".repeat(24), name: "Admin", email, role: "admin", password: await hashPassword(password) };
  const customer = { _id: "2".repeat(24), name: "Customer", email: "customer@example.test", role: "customer", password: admin.password };
  const users = [admin, customer];
  t.mock.method(User, "findOne", query => ({ select: async () => users.find(user => user.email === query.email) }));
  t.mock.method(User, "findById", id => ({ select: async () => users.find(user => user._id === id) }));
  t.mock.method(User, "exists", async query => users.some(user => user.email === query.email && user.role === query.role));
  t.mock.method(Queue, "find", () => ({ populate: async () => [] }));
  t.mock.method(User, "find", () => ({ select() { return this; }, sort: async () => [] }));

  const realFetch = globalThis.fetch;
  let keyRequests = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, `https://${team}/cdn-cgi/access/certs`);
    assert.equal(options.redirect, "error");
    keyRequests += 1;
    return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), alg: "RS256", use: "sig", kid: "fixture-key" }] });
  });

  const { default: app } = await import("../app.js");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const assertion = signAccess();
  const request = (path, { access, body, token, method = body ? "POST" : "GET" } = {}) => realFetch(
    `http://127.0.0.1:${server.address().port}/api${path}`, {
      method, redirect: "manual",
      headers: {
        origin: "https://www.serveq.tech",
        ...(access && { "Cf-Access-Jwt-Assertion": access }),
        ...(token && { authorization: `Bearer ${token}` }),
        ...(body && { "content-type": "application/json" }),
      },
      ...(body && { body: JSON.stringify(body) }),
    },
  );
  const credentials = user => ({ email: user.email, password });
  const correct = { access: assertion, body: credentials(admin) };

  assert.equal((await request("/admin/access")).status, 403);
  for (const access of [
    signAccess({ aud: ["b".repeat(64)] }),
    signAccess({ iss: "https://other.cloudflareaccess.com" }),
    signAccess({ email: customer.email }),
    signAccess({ type: "org" }),
    signAccess({ sub: "" }),
    signAccess({ exp: 1 }),
  ]) {
    assert.equal((await request("/admin/access", { access })).status, 403);
  }
  assert.equal((await request("/admin/access", { access: assertion })).status, 204);
  assert.equal(keyRequests, 1);
  const reentry = await request("/admin/access?return=1", { access: assertion });
  assert.equal(reentry.headers.get("location"), "https://www.serveq.tech/admin/login");
  assert.equal((await request("/admin/access", { method: "OPTIONS" })).status, 204);

  assert.equal((await request("/admin/signin", { body: credentials(admin) })).status, 403);
  assert.equal((await request("/admin/signin", { access: assertion, body: credentials(customer) })).status, 403);
  assert.equal((await request("/auth/signin", { access: assertion, body: { ...credentials(admin), requiredRole: "admin" } })).status, 403);
  assert.equal((await request("/auth/signin", { body: credentials(customer) })).status, 200);
  assert.equal((await request("/auth/me", { token: generateToken(admin) })).status, 401);
  assert.equal((await request("/admin/users", { access: assertion, token: generateToken(customer) })).status, 403);
  assert.equal((await request("/admin/applications")).status, 403);

  const login = await request("/admin/signin", correct);
  assert.equal(login.status, 200);
  assert.match(login.headers.get("cache-control"), /no-store/);
  assert.equal((await login.json()).data.token, undefined);
  const token = login.headers.get("set-cookie").split(";")[0].slice("token=".length);
  assert.equal(jwt.decode(token).exp, jwt.decode(assertion).exp);
  assert.equal((await request("/admin/users", { token })).status, 403);
  assert.equal((await request("/admin/users", { token, access: assertion })).status, 200);
  assert.equal((await request("/auth/me", { token })).status, 200);

  admin.role = "customer";
  assert.equal((await request("/admin/access", { access: assertion })).status, 403);
  delete process.env.CLOUDFLARE_ADMIN_ACCESS_AUD;
  assert.equal((await request("/admin/access", { access: assertion })).status, 503);
});
