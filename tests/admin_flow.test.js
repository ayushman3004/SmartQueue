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
});
