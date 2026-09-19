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
    } finally {
      server.close();
    }
  });
});
