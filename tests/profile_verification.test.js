import test from "node:test";
import assert from "node:assert/strict";
import Otp from "../src/modules/auth/otp.model.js";
import User from "../src/modules/auth/auth.model.js";
import * as verificationService from "../src/modules/auth/verification.service.js";

test("Profile Contact Verification Flow - Phone & Email OTP (nodemailer-otp & Nodemailer)", async (t) => {
  const originalOtpFindOne = Otp.findOne;
  const originalOtpFindOneAndUpdate = Otp.findOneAndUpdate;
  const originalOtpDeleteOne = Otp.deleteOne;
  const originalUserFindById = User.findById;
  const originalUserFindOne = User.findOne;

  t.afterEach(() => {
    Otp.findOne = originalOtpFindOne;
    Otp.findOneAndUpdate = originalOtpFindOneAndUpdate;
    Otp.deleteOne = originalOtpDeleteOne;
    User.findById = originalUserFindById;
    User.findOne = originalUserFindOne;
  });

  const mockUser = {
    _id: "654321654321654321654321",
    name: "Shayam",
    email: "shayam@example.com",
    phone: "+919876543210",
    role: "owner",
    isEmailVerified: false,
    isPhoneVerified: false,
    save: async function () {
      return this;
    },
  };

  await t.test("Rejects email OTP request for invalid email address", async () => {
    await assert.rejects(
      async () => {
        await verificationService.sendEmailVerificationOtp({
          email: "invalid-email",
          userId: mockUser._id,
        });
      },
      { message: "Please provide a valid email format" }
    );
  });

  await t.test("Generates and dispatches email verification OTP using nodemailer-otp", async () => {
    let upsertedData = null;
    Otp.findOne = async () => null; // No cooldown
    User.findOne = async () => null; // Email not taken
    Otp.findOneAndUpdate = async (query, update) => {
      upsertedData = { query, update };
      return { ...query, ...update };
    };

    const res = await verificationService.sendEmailVerificationOtp({
      email: "newemail@example.com",
      userId: mockUser._id,
      userName: mockUser.name,
    });

    assert.equal(res.success, true);
    assert.ok(upsertedData);
    assert.equal(upsertedData.query.email, "newemail@example.com");
    assert.equal(upsertedData.query.purpose, "email_verification");
    assert.equal(typeof upsertedData.update.otp, "string");
    assert.equal(upsertedData.update.otp.length, 6);
  });

  await t.test("Successfully verifies email OTP and updates isEmailVerified", async () => {
    const userDoc = { ...mockUser, isEmailVerified: false, save: async function () { return this; } };
    User.findById = async () => userDoc;

    const otpDoc = {
      _id: "otp123",
      email: "newemail@example.com",
      otp: "123456",
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      save: async function () { return this; },
    };
    Otp.findOne = async () => otpDoc;
    let deleted = false;
    Otp.deleteOne = async () => { deleted = true; };

    const res = await verificationService.verifyEmailVerificationOtp({
      email: "newemail@example.com",
      otp: "123456",
      userId: mockUser._id,
    });

    assert.equal(res.success, true);
    assert.equal(userDoc.email, "newemail@example.com");
    assert.equal(userDoc.isEmailVerified, true);
    assert.equal(deleted, true);
    assert.equal(res.user.isEmailVerified, true);
  });

  await t.test("Generates and stores phone OTP", async () => {
    let upsertedPhoneData = null;
    Otp.findOne = async () => null; // No cooldown
    User.findById = async () => mockUser;
    Otp.findOneAndUpdate = async (query, update) => {
      upsertedPhoneData = { query, update };
      return { ...query, ...update };
    };

    const res = await verificationService.sendPhoneVerificationOtp({
      phone: "+919876543210",
      userId: mockUser._id,
    });

    assert.equal(res.success, true);
    assert.ok(upsertedPhoneData);
    assert.equal(upsertedPhoneData.query.phoneNumber, "+919876543210");
    assert.equal(upsertedPhoneData.query.purpose, "phone_verification");
    assert.equal(upsertedPhoneData.update.otp.length, 6);
  });

  await t.test("Successfully verifies phone OTP and marks isPhoneVerified", async () => {
    const userDoc = { ...mockUser, isPhoneVerified: false, save: async function () { return this; } };
    User.findById = async () => userDoc;

    const otpDoc = {
      _id: "otp456",
      phoneNumber: "+919876543210",
      otp: "654321",
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      save: async function () { return this; },
    };
    Otp.findOne = async () => otpDoc;
    let deleted = false;
    Otp.deleteOne = async () => { deleted = true; };

    const res = await verificationService.verifyPhoneVerificationOtp({
      phone: "+919876543210",
      otp: "654321",
      userId: mockUser._id,
    });

    assert.equal(res.success, true);
    assert.equal(userDoc.phone, "+919876543210");
    assert.equal(userDoc.isPhoneVerified, true);
    assert.equal(deleted, true);
    assert.equal(res.user.isPhoneVerified, true);
  });
});
