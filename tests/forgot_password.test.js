import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/modules/auth/auth.model.js";
import Otp from "../src/modules/auth/otp.model.js";
import {
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} from "../src/modules/auth/forgotPassword.service.js";
import { comparePassword } from "../src/modules/auth.utils.js";

test("Forgot Password Flow - Nodemailer OTP Verification & Password Reset", async (t) => {
  const originalUserFindOne = User.findOne;
  const originalOtpFindOne = Otp.findOne;
  const originalOtpFindOneAndUpdate = Otp.findOneAndUpdate;
  const originalOtpDeleteMany = Otp.deleteMany;

  t.afterEach(() => {
    User.findOne = originalUserFindOne;
    Otp.findOne = originalOtpFindOne;
    Otp.findOneAndUpdate = originalOtpFindOneAndUpdate;
    Otp.deleteMany = originalOtpDeleteMany;
  });

  await t.test("Rejects OTP request for invalid or empty email", async () => {
    await assert.rejects(
      () => sendPasswordResetOtp(""),
      /Email address is required/i
    );

    await assert.rejects(
      () => sendPasswordResetOtp("invalid-email"),
      /valid email address/i
    );
  });

  await t.test("Rejects OTP request if user account does not exist", async () => {
    User.findOne = async () => null;

    await assert.rejects(
      () => sendPasswordResetOtp("notfound@example.com"),
      /No account found with this email/i
    );
  });

  await t.test("Generates 6-digit OTP and creates Otp record for existing user", async () => {
    const existingUser = {
      _id: "user-123",
      email: "user@serveq.tech",
      name: "Test User",
    };
    User.findOne = async () => existingUser;

    let upsertPayload = null;
    Otp.findOne = async () => null;
    Otp.findOneAndUpdate = async (query, update) => {
      upsertPayload = { query, update };
      return { ...update, ...query };
    };

    const result = await sendPasswordResetOtp("user@serveq.tech");

    assert.equal(result.email, "user@serveq.tech");
    assert.equal(upsertPayload.query.email, "user@serveq.tech");
    assert.equal(upsertPayload.query.purpose, "forgot_password");
    assert.match(upsertPayload.update.otp, /^\d{6}$/);
    assert.equal(upsertPayload.update.attempts, 0);
    assert.equal(upsertPayload.update.verified, false);
  });

  await t.test("Enforces 30-second cooldown on consecutive OTP requests", async () => {
    User.findOne = async () => ({ _id: "u-1", email: "user@serveq.tech", name: "User" });
    Otp.findOne = async () => ({
      email: "user@serveq.tech",
      purpose: "forgot_password",
      lastResentAt: new Date(), // requested right now
    });

    await assert.rejects(
      () => sendPasswordResetOtp("user@serveq.tech"),
      /Please wait \d+ seconds/i
    );
  });

  await t.test("Rejects OTP verification if code has expired or is missing", async () => {
    Otp.findOne = async () => null;

    await assert.rejects(
      () => verifyPasswordResetOtp("user@serveq.tech", "123456"),
      /expired or was not requested/i
    );
  });

  await t.test("Increments attempts on incorrect OTP and rejects", async () => {
    const otpDoc = {
      email: "user@serveq.tech",
      otp: "999888",
      attempts: 0,
      expiresAt: new Date(Date.now() + 600000),
      save: async function () {},
    };
    Otp.findOne = async () => otpDoc;

    await assert.rejects(
      () => verifyPasswordResetOtp("user@serveq.tech", "111222"),
      /Invalid verification code/i
    );

    assert.equal(otpDoc.attempts, 1);
  });

  await t.test("Successfully verifies valid OTP and returns resetToken", async () => {
    const otpDoc = {
      email: "user@serveq.tech",
      otp: "543210",
      attempts: 0,
      expiresAt: new Date(Date.now() + 600000),
      verified: false,
      resetToken: null,
      save: async function () {},
    };
    Otp.findOne = async () => otpDoc;

    const result = await verifyPasswordResetOtp("user@serveq.tech", "543210");

    assert.equal(result.email, "user@serveq.tech");
    assert.ok(result.resetToken);
    assert.equal(result.resetToken.length, 64); // 32 hex bytes
    assert.equal(otpDoc.verified, true);
    assert.equal(otpDoc.resetToken, result.resetToken);
  });

  await t.test("Rejects password reset if new password does not meet complexity guidelines", async () => {
    await assert.rejects(
      () =>
        resetPassword({
          rawEmail: "user@serveq.tech",
          resetToken: "valid-token",
          newPassword: "short",
        }),
      /at least 8 characters/i
    );

    await assert.rejects(
      () =>
        resetPassword({
          rawEmail: "user@serveq.tech",
          resetToken: "valid-token",
          newPassword: "nouppercase123!",
        }),
      /capital letter/i
    );

    await assert.rejects(
      () =>
        resetPassword({
          rawEmail: "user@serveq.tech",
          resetToken: "valid-token",
          newPassword: "NoSymbols12345",
        }),
      /special symbol/i
    );
  });

  await t.test("Successfully updates password with valid resetToken and clears OTP record", async () => {
    const activeOtpDoc = {
      _id: "otp-doc-1",
      email: "user@serveq.tech",
      resetToken: "test-valid-token-123",
      verified: true,
      expiresAt: new Date(Date.now() + 600000),
    };
    Otp.findOne = async () => activeOtpDoc;

    let deleted = false;
    Otp.deleteMany = async () => {
      deleted = true;
    };

    const userDoc = {
      _id: "user-1",
      email: "user@serveq.tech",
      password: "old-hashed-password",
      authProvider: "local",
      save: async function () {},
    };
    User.findOne = async () => userDoc;

    const result = await resetPassword({
      rawEmail: "user@serveq.tech",
      resetToken: "test-valid-token-123",
      newPassword: "NewSecurePassword123!",
    });

    assert.equal(result.success, true);
    assert.equal(deleted, true);
    // Verify password was hashed and changed
    assert.notEqual(userDoc.password, "old-hashed-password");
    assert.notEqual(userDoc.password, "NewSecurePassword123!");
    const isMatch = await comparePassword("NewSecurePassword123!", userDoc.password);
    assert.equal(isMatch, true);
  });
});
