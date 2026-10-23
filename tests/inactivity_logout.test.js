import test from "node:test";
import assert from "node:assert/strict";
import {
  INACTIVITY_TIMEOUT_MS,
  ACTIVITY_THROTTLE_MS,
  LAST_ACTIVE_KEY,
} from "../src/utils/sessionConstants.js";

test("Inactivity Auto-Logout Configuration & Time calculations", async (t) => {
  await t.test("INACTIVITY_TIMEOUT_MS is configured to exactly 10 minutes (600,000 ms)", () => {
    assert.equal(INACTIVITY_TIMEOUT_MS, 10 * 60 * 1000);
    assert.equal(INACTIVITY_TIMEOUT_MS, 600000);
  });

  await t.test("ACTIVITY_THROTTLE_MS is 2000 ms to optimize performance", () => {
    assert.equal(ACTIVITY_THROTTLE_MS, 2000);
  });

  await t.test("LAST_ACTIVE_KEY is serveq_last_active for local and cross-tab sync", () => {
    assert.equal(LAST_ACTIVE_KEY, "serveq_last_active");
  });

  await t.test("Inactivity evaluation correctly flags user as inactive after 10 minutes", () => {
    const now = Date.now();
    const tenMinutesAndOneSecAgo = now - (10 * 60 * 1000 + 1000);
    const idleTime = now - tenMinutesAndOneSecAgo;
    assert.equal(idleTime >= INACTIVITY_TIMEOUT_MS, true);
  });

  await t.test("Inactivity evaluation keeps session active when user interacted 9 minutes ago", () => {
    const now = Date.now();
    const nineMinutesAgo = now - 9 * 60 * 1000;
    const idleTime = now - nineMinutesAgo;
    assert.equal(idleTime >= INACTIVITY_TIMEOUT_MS, false);
    const remainingTime = INACTIVITY_TIMEOUT_MS - idleTime;
    assert.equal(remainingTime, 60 * 1000);
  });
});
