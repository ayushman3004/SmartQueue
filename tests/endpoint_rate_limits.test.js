import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import express from "express";
import app from "../app.js";
import User from "../src/modules/auth/auth.model.js";
import { createRateLimiter } from "../src/gateway/rateLimiter.js";
import { configureRateLimitStore, createMemoryRateLimitStore, createRedisRateLimitStore } from "../src/gateway/rateLimitStore.js";

async function serve(app, t) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

test("password reset send aliases share a normalized recipient quota and emit Retry-After", async t => {
  t.mock.method(User, "findOne", async () => null);
  const base = await serve(app, t);
  const paths = ["/api/auth/forgot-password", "/api/auth/forgot-password/send-otp"];
  for (let n = 0; n < 4; n++) {
    const response = await fetch(base + paths[n % 2], {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "https://serveq.tech" },
      body: JSON.stringify({ email: n % 2 ? "  PERSON@EXAMPLE.COM  " : "person@example.com" }),
    });
    assert.equal(response.status, n === 3 ? 429 : 200);
    if (n === 3) {
      const { retryAfterSeconds } = await response.json();
      assert.equal(response.headers.get("retry-after"), String(retryAfterSeconds));
      assert.ok(retryAfterSeconds > 0 && retryAfterSeconds <= 300);
      assert.match(response.headers.get("access-control-expose-headers"), /Retry-After/);
    }
  }
});

test("general API tolerates a store outage while sign-in stops before auth and webhooks still reach signature checks", async t => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = "local-fixture-webhook-secret";
  t.after(() => {
    if (webhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
  });
  t.mock.method(User, "findOne", () => assert.fail("Redis outage must stop sign-in before database access"));
  let checks = 0;
  app.locals.rateLimitStore = { consume() { checks++; throw new Error("offline"); } };
  t.after(() => { delete app.locals.rateLimitStore; });
  const base = await serve(app, t);
  assert.equal((await fetch(base + "/api/auth/me")).status, 401);
  assert.equal(checks, 1);
  const signedRoute = await fetch(base + "/api/payments/webhook", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal(signedRoute.status, 400);
  assert.match((await signedRoute.json()).message, /signature/i);
  assert.equal(checks, 1);
  const signIn = await fetch(base + "/api/auth/signin", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "person@example.com", password: "local-test-value" }),
  });
  assert.equal(signIn.status, 503);
  assert.equal(signIn.headers.get("retry-after"), "5");
  assert.throws(() => configureRateLimitStore(express(), { NODE_ENV: "production" }), /REDIS_URL/);
});

test("trusted IPv6 addresses on one /64 share a bucket; forwarded headers cannot rotate it", async t => {
  const fixture = express();
  fixture.locals.rateLimitStore = createMemoryRateLimitStore();
  fixture.use((req, _res, next) => {
    req.clientIp = req.query.ip; // Simulate attribution after the separate origin-guard test.
    next();
  });
  fixture.get("/", createRateLimiter({ name: "ipv6-test", max: 1 }), (_req, res) => res.sendStatus(204));
  const base = await serve(fixture, t);
  assert.equal((await fetch(base + "/?ip=2001:db8:1:2::1")).status, 204);
  assert.equal((await fetch(base + "/?ip=2001:db8:1:2::f", {
    headers: { "X-Forwarded-For": "203.0.113.5", "CF-Connecting-IP": "203.0.113.6" },
  })).status, 429);
  assert.equal((await fetch(base + "/?ip=2001:db8:1:3::1")).status, 204);
});

const redisUrl = process.env.RATE_LIMIT_TEST_REDIS_URL;
test("concurrent Redis clients enforce one budget and expire it", { skip: !redisUrl, timeout: 10_000 }, async t => {
  const a = createRedisRateLimitStore(redisUrl);
  const b = createRedisRateLimitStore(redisUrl);
  t.after(() => { a.close(); b.close(); });
  await Promise.all([a.connect(), b.connect()]);
  const key = "serveq:ratelimit:test:" + randomUUID();
  const policy = { max: 3, windowMs: 1000 };
  const results = await Promise.all(Array.from({ length: 16 }, (_, index) =>
    (index % 2 ? a : b).consume(key, policy)));
  assert.equal(results.filter(result => result.allowed).length, 3);
  const last = await b.consume(key, policy);
  assert.equal(last.allowed, false);
  assert.equal(last.count, 3);
  assert.ok(last.retryMs > 0 && last.retryMs <= policy.windowMs);
  await new Promise(resolve => setTimeout(resolve, last.retryMs + 20));
  assert.equal((await a.consume(key, policy)).allowed, true);
  const claimKey = "serveq:turnstile:test:" + randomUUID();
  const claims = await Promise.all([a.claimOnce(claimKey, 1000), b.claimOnce(claimKey, 1000)]);
  assert.equal(claims.filter(Boolean).length, 1);
});
