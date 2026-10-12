import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Booking from "../src/booking/booking.model.js";
import { createRateLimiter } from "../src/gateway/rateLimiter.js";

test("Admin & Security Flow - Role Protection & Gateway", async (t) => {
  await t.test("Booking model registers alias so Appointment model exists without crash", () => {
    assert.ok(mongoose.models.Booking);
    assert.ok(mongoose.models.Appointment);
  });

  await t.test("Gateway rate limiter blocks after hitting max thresholds", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
    const req = { ip: "127.0.0.1", headers: {}, socket: {} };
    let statusSet = null;
    const res = {
      setHeader: () => {},
      status: (code) => {
        statusSet = code;
        return { json: () => {} };
      },
    };

    let called = 0;
    const next = () => { called++; };

    limiter(req, res, next); // 1st
    limiter(req, res, next); // 2nd
    assert.equal(called, 2);

    limiter(req, res, next); // 3rd (exceeds limit)
    assert.equal(statusSet, 429);
  });

  await t.test("Socket presence tracking reflects online users and hubs", async () => {
    const { isUserOnline, isHubOnline, onlineUsers, onlineHubs } = await import("../realtime/socket.js");
    const dummyUserId = "user_test_999";
    const dummyHubId = "hub_test_888";

    assert.equal(isUserOnline(dummyUserId), false);
    assert.equal(isHubOnline(dummyHubId), false);

    onlineUsers.set(dummyUserId, new Set(["sock_1"]));
    assert.equal(isUserOnline(dummyUserId), true);

    onlineHubs.set(dummyHubId, new Set(["sock_2"]));
    assert.equal(isHubOnline(dummyHubId), true);

    // cleanup
    onlineUsers.delete(dummyUserId);
    onlineHubs.delete(dummyHubId);
    assert.equal(isUserOnline(dummyUserId), false);
    assert.equal(isHubOnline(dummyHubId), false);
  });
});

