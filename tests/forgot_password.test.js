import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import User from "../src/modules/auth/auth.model.js";
import Otp from "../src/modules/auth/otp.model.js";
import {
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} from "../src/modules/auth/forgotPassword.service.js";
import { comparePassword } from "../src/modules/auth.utils.js";

process.env.JWT_SECRET = "password-recovery-fixture-key";

test("password recovery stores digests and consumes one credential through either flow", async t => {
  const email = "user@serveq.tech";
  const user = { _id: "610000000000000000000000", email, name: "Test User", password: "previous", tokenVersion: 0 };
  let record, deliveredCode;
  t.mock.method(User, "findOne", ({ email: requested }) => {
    const value = requested === email ? user : null;
    return { select: async () => value, then: resolve => Promise.resolve(value).then(resolve) };
  });
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter._id, user._id);
    assert.equal(filter.email, email);
    assert.equal(filter.password, user.password);
    Object.assign(user, update.$set);
    user.tokenVersion += update.$inc.tokenVersion;
    return user;
  });
  const oldApiKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "recovery-test-key";
  t.after(() => {
    if (oldApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldApiKey;
  });
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    deliveredCode = JSON.parse(options.body).text.match(/\b\d{6}\b/)[0];
    return Response.json({ id: "test-mail" });
  });

  const matchesProof = query => record?._id === query._id &&
    record.email === query.email && record.accountTokenVersion === query.accountTokenVersion &&
    record.verified === query.verified && record.resetToken === query.resetToken;
  t.mock.method(Otp, "exists", async query => matchesProof(query));
  t.mock.method(Otp, "findOneAndDelete", async query => {
    if (!matchesProof(query)) return null;
    const consumed = record;
    record = undefined;
    return consumed;
  });
  t.mock.method(Otp, "findOne", async query => (
    record && record.email === query.email && query.otp.test(record.otp) && record.expiresAt > query.expiresAt.$gt ? { ...record } : null
  ));
  t.mock.method(Otp, "findOneAndUpdate", async (query, update, options) => {
    if (options.upsert) {
      if (record?.lastResentAt > query.$or[0].lastResentAt.$lte) {
        throw Object.assign(new Error("atomic cooldown collision"), { code: 11000 });
      }
      record = { _id: query._id, ...update.$set };
      return record;
    }
    if (!record || query.challenge !== record.challenge || record.verified || record.attempts >= query.attempts.$lt) return null;
    if (update.$inc) record.attempts += update.$inc.attempts;
    if (update.$set) Object.assign(record, update.$set);
    if (update.$unset?.otp) delete record.otp;
    return record;
  });

  const proposed = "NewSecurePassword123!";
  const reset = args => resetPassword({ rawEmail: email, newPassword: proposed, ...args });
  const wrongCode = () => deliveredCode === "123456" ? "123457" : "123456";
  await assert.rejects(sendPasswordResetOtp("invalid"), { statusCode: 400 });
  await assert.rejects(sendPasswordResetOtp("other@serveq.tech"), { statusCode: 404 });
  await assert.rejects(verifyPasswordResetOtp(email, "123456"), { statusCode: 400 });
  await assert.rejects(reset({ resetToken: "example", newPassword: "short" }), /at least 8 characters/);

  await sendPasswordResetOtp(email);
  assert.match(deliveredCode, /^\d{6}$/);
  assert.match(record.otp, /^[a-f0-9]{64}$/);
  assert.notEqual(record.otp, deliveredCode);
  await assert.rejects(sendPasswordResetOtp(email), { statusCode: 429 });
  await assert.rejects(reset({ otp: wrongCode() }), { statusCode: 400 });
  const attempts = await Promise.allSettled(Array.from({ length: 6 }, () => verifyPasswordResetOtp(email, wrongCode())));
  assert.ok(attempts.every(attempt => attempt.status === "rejected"));
  assert.equal(record.attempts, 5);
  await assert.rejects(reset({ otp: deliveredCode }), { statusCode: 429 });

  record.lastResentAt = new Date(0);
  await sendPasswordResetOtp(email);
  const exchanges = await Promise.allSettled([verifyPasswordResetOtp(email, deliveredCode), verifyPasswordResetOtp(email, deliveredCode)]);
  const [exchange] = exchanges.filter(result => result.status === "fulfilled");
  assert.equal(exchanges.filter(result => result.status === "fulfilled").length, 1);
  const { resetToken } = exchange.value;
  assert.equal(record.otp, undefined);
  assert.equal(record.resetToken, createHash("sha256").update(resetToken).digest("hex"));
  assert.notEqual(record.resetToken, resetToken);

  const results = await Promise.allSettled([reset({ resetToken }), reset({ resetToken })]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(user.tokenVersion, 1);
  assert.equal(await comparePassword(proposed, user.password), true);

  await sendPasswordResetOtp(email);
  await reset({ otp: deliveredCode });
  assert.equal(user.tokenVersion, 2);
  await assert.rejects(reset({ otp: deliveredCode }), { statusCode: 400 });
});
