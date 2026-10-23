import { test, describe } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import app from "../app.js";

describe("Health Check Endpoints", () => {
  test("GET /health responds with 200 and status ok", async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/health`);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.status, "ok");
      assert.ok(typeof data.uptime === "number");
      assert.ok(typeof data.timestamp === "string");
      assert.ok(data.database);
      assert.ok(data.memory && typeof data.memory.rssMb === "number");
    } finally {
      server.close();
    }
  });

  test("GET /api/health responds with 200 and status ok", async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.status, "ok");
      assert.ok(data.database);
    } finally {
      server.close();
    }
  });

  test("GET /healthz and /live respond with liveness probe 200 ok", async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const resLive = await fetch(`http://localhost:${port}/live`);
      assert.equal(resLive.status, 200);
      const dataLive = await resLive.json();
      assert.equal(dataLive.status, "ok");
      assert.ok(typeof dataLive.uptime === "number");

      const resHealthz = await fetch(`http://localhost:${port}/healthz`);
      assert.equal(resHealthz.status, 200);
      const dataHealthz = await resHealthz.json();
      assert.equal(dataHealthz.status, "ok");
    } finally {
      server.close();
    }
  });

  test("GET /health/ready reflects database readiness appropriately", async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/health/ready`);
      // In isolated tests without DB connected, readiness returns 503 not_ready
      const data = await res.json();
      assert.ok([200, 503].includes(res.status));
      assert.ok(["ready", "not_ready"].includes(data.status));
      assert.ok(data.database);
    } finally {
      server.close();
    }
  });

  test("GET /health/detailed returns diagnostic subsystem state", async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/health/detailed`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(["healthy", "degraded"].includes(data.status));
      assert.equal(data.architecture, "modular-monolith");
      assert.equal(data.gateway, "active");
      assert.ok(data.services);
      assert.ok(data.memory);
    } finally {
      server.close();
    }
  });
});
