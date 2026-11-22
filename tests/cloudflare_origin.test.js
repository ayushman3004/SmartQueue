import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import http from "node:http";
import { test } from "node:test";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import express from "express";

process.env.CLOUDFLARE_ORIGIN_SECRET = randomBytes(32).toString("hex");
const { default: app } = await import("../app.js");
const { cloudflareOriginGuard, createCloudflareOriginGuard } = await import("../middleware/cloudflare-origin.middleware.js");
const { createRateLimiter } = await import("../src/gateway/rateLimiter.js");

const edgeHeaders = {
  "x-serveq-origin-auth": process.env.CLOUDFLARE_ORIGIN_SECRET,
  "x-serveq-client-ip": "2001:db8::1",
};
const forgedHeaders = {
  "x-forwarded-for": "198.51.100.1",
  "x-forwarded-proto": "https",
  "cf-connecting-ip": "198.51.100.2",
  "x-serveq-client-ip": "198.51.100.3",
};

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

test("Express requires edge credentials for API and preflight while Render probes still work", async t => {
  const server = http.createServer(app);
  const base = await listen(server);
  t.after(() => server.close());
  assert.equal(app.get("trust proxy"), false);
  assert.throws(() => createCloudflareOriginGuard("short"), /64 lowercase hexadecimal/);

  const origin = { Origin: "https://serveq.tech" };
  const rejected = await fetch(base + "/api/auth/me", { headers: forgedHeaders });
  assert.equal(rejected.status, 404);
  assert.equal(rejected.headers.get("x-powered-by"), null);
  assert.equal(await rejected.text(), '{"message":"Not found"}');
  const valid = await fetch(base + "/api/auth/me", { headers: { ...edgeHeaders, ...origin } });
  assert.equal(valid.status, 401);
  assert.equal(valid.headers.get("access-control-allow-origin"), origin.Origin);

  const preflight = { ...origin, "Access-Control-Request-Method": "GET" };
  for (const [headers, status] of [[preflight, 404], [{ ...preflight, ...edgeHeaders }, 204]]) {
    const response = await fetch(base + "/api/auth/me", { method: "OPTIONS", headers });
    assert.equal(response.status, status);
  }
  assert.equal((await fetch(base + "/live")).status, 200);
  assert.equal((await fetch(base + "/live", { method: "POST" })).status, 404);
  assert.equal((await fetch(base + "/api/health/ready")).status, 404);

  const originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  t.after(() => { process.env.NODE_ENV = originalEnvironment; });
  const ready = await fetch(base + "/ready");
  assert.equal(ready.status, 503);
  assert.equal(ready.headers.get("cache-control"), "no-store");
  assert.deepEqual(await ready.json(), { status: "not_ready" });
  assert.deepEqual(await (await fetch(base + "/health", { headers: edgeHeaders })).json(), { status: "ok" });
  assert.equal((await fetch(base + "/health/detailed", { headers: edgeHeaders })).status, 404);
});

test("rate limits key on authenticated edge IPv4 or IPv6 and reject malformed IP headers", async t => {
  const fixture = express();
  fixture.use(cloudflareOriginGuard, createRateLimiter({ max: 1 }));
  fixture.get("/", (req, res) => res.json({ ip: req.clientIp }));
  const server = http.createServer(fixture);
  const base = await listen(server);
  t.after(() => server.close());

  const request = headers => fetch(base, { headers: { ...edgeHeaders, ...headers } });
  assert.equal((await request({ "x-serveq-origin-auth": "0".repeat(64) })).status, 404);
  assert.equal((await request({ "x-serveq-client-ip": "198.51.100.1, 198.51.100.2" })).status, 404);
  const first = await request({ "x-forwarded-for": "198.51.100.4" });
  assert.deepEqual(await first.json(), { ip: "2001:db8::1" });
  assert.equal((await request({ "x-forwarded-for": "198.51.100.5" })).status, 429);
  assert.equal((await request({ "x-serveq-client-ip": "198.51.100.6" })).status, 200);
});

test("Socket.IO requires the edge credential on polling and WebSocket requests", async t => {
  const server = http.createServer();
  const io = new Server(server);
  io.engine.use(cloudflareOriginGuard);
  const base = await listen(server);
  t.after(() => io.close());

  const pollingUrl = base + "/socket.io/?EIO=4&transport=polling";
  assert.equal((await fetch(pollingUrl, { headers: forgedHeaders })).status, 404);
  const handshake = await fetch(pollingUrl, { headers: edgeHeaders });
  assert.equal(handshake.status, 200);
  const { sid } = JSON.parse((await handshake.text()).slice(1));
  assert.equal((await fetch(pollingUrl + "&sid=" + sid, {
    method: "POST", body: "40", headers: forgedHeaders,
  })).status, 404);
  assert.equal((await fetch(pollingUrl + "&sid=" + sid, {
    method: "POST", body: "40", headers: edgeHeaders,
  })).status, 200);

  for (const [headers, expected] of [[forgedHeaders, "connect_error"], [edgeHeaders, "connect"]]) {
    const client = connect(base, { transports: ["websocket"], reconnection: false, extraHeaders: headers, timeout: 2000 });
    try {
      await new Promise((resolve, reject) => {
        client.once(expected, resolve);
        client.once(expected === "connect" ? "connect_error" : "connect", reject);
      });
    } finally {
      client.disconnect();
    }
  }
});
