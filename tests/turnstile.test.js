import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import express from "express";
import { createTurnstileProtection } from "../middleware/turnstile.middleware.js";

const config = {
  TURNSTILE_MODE: "enforce",
  TURNSTILE_SECRET_KEY: "fixture-server-secret",
  TURNSTILE_ALLOWED_HOSTNAMES: "serveq.tech, www.serveq.tech",
};

async function fixture(t, { mode = "enforce", fetchImpl, claimOnce, signedIn = false } = {}) {
  const app = express();
  const protection = createTurnstileProtection({ env: { ...config, TURNSTILE_MODE: mode }, fetchImpl });
  app.locals.rateLimitStore = claimOnce && { claimOnce };
  app.use(express.json());
  if (signedIn) app.use((req, _res, next) => { req.user = { _id: "fixture-user" }; next(); });
  app.post("/business", protection("business_application"), (req, res) => res.json(req.body));
  app.post("/support", protection("guest_support", { anonymousOnly: true }), (_req, res) => res.sendStatus(204));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  return (route, token) => fetch(`http://127.0.0.1:${server.address().port}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Fixture", turnstileToken: token }),
  });
}

test("enforced Turnstile validates hostname and action and allows only one concurrent redemption", async t => {
  const claims = new Set();
  const request = await fixture(t, {
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
      assert.equal(options.body.get("secret"), config.TURNSTILE_SECRET_KEY);
      assert.equal(options.redirect, "error");
      const token = options.body.get("response");
      return Response.json({
        success: token !== "failed",
        action: token === "action" ? "guest_support" : "business_application",
        hostname: token === "host" ? "untrusted.example" : "serveq.tech",
      });
    },
    claimOnce: async (key, ttl) => {
      assert.match(key, /^serveq:turnstile:v1:[a-f0-9]{64}$/);
      assert.equal(ttl, 300_000);
      if (claims.has(key)) return false;
      claims.add(key);
      return true;
    },
  });
  for (const token of [undefined, {}, "a".repeat(2049), "failed", "action", "host"]) {
    const response = await request("/business", token);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "TURNSTILE_REQUIRED");
  }
  assert.equal(claims.size, 0);
  const responses = await Promise.all([request("/business", "valid"), request("/business", "valid")]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 403]);
  assert.deepEqual(await responses.find(response => response.ok).json(), { name: "Fixture" });
});

test("observe mode preserves submissions and enforced mode distinguishes provider failures", async t => {
  const unavailable = async () => new Response(null, { status: 503 });
  const observe = await fixture(t, { mode: "observe", fetchImpl: unavailable, claimOnce: async () => true });
  assert.deepEqual(await (await observe("/business", "sample")).json(), { name: "Fixture" });
  assert.equal((await observe("/business")).status, 200);
  const enforce = await fixture(t, { fetchImpl: unavailable, claimOnce: async () => true });
  const response = await enforce("/business", "sample");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "5");
  assert.equal((await response.json()).code, "TURNSTILE_UNAVAILABLE");
});

test("authenticated support and the default off mode do not require a widget", async t => {
  const authenticated = await fixture(t, { signedIn: true });
  const disabled = await fixture(t, { mode: "off" });
  assert.equal((await authenticated("/support")).status, 204);
  assert.equal((await authenticated("/business")).status, 403);
  assert.equal((await disabled("/business")).status, 200);
  assert.equal((await disabled("/support")).status, 204);
});
