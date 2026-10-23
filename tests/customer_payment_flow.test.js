import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import {
  verifyPaymentSignature,
  verifyWebhookSignature,
  getPublicPaymentConfig,
} from "../src/modules/payment/razorpay.service.js";
import { validateAmount } from "../src/modules/payment/payment.service.js";

test("Customer Payment Flow - Server-Side Amount Recalculation & Validation", async (t) => {
  await t.test("Rejects zero, negative, and NaN amounts", () => {
    assert.throws(() => validateAmount(0), /positive number/);
    assert.throws(() => validateAmount(-150), /positive number/);
    assert.throws(() => validateAmount("invalid-cost"), /positive number/);
    assert.throws(() => validateAmount(null), /positive number/);
  });

  await t.test("Validates proper numeric positive amounts", () => {
    assert.equal(validateAmount(350), 350);
    assert.equal(validateAmount("499.50"), 499.5);
  });
});

test("Customer Payment Flow - Razorpay Signature Verification Security", async (t) => {
  const secret = "test_secret_key_12345";
  const orderId = "order_test_987654";
  const paymentId = "pay_test_123456";

  const validSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  await t.test("Valid HMAC SHA256 signature returns true", () => {
    const isValid = verifyPaymentSignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: validSignature,
      secretOverride: secret,
    });
    assert.equal(isValid, true);
  });

  await t.test("Tampered payment ID or order ID fails signature verification", () => {
    const isTamperedOrder = verifyPaymentSignature({
      razorpayOrderId: "order_tampered_000",
      razorpayPaymentId: paymentId,
      razorpaySignature: validSignature,
      secretOverride: secret,
    });
    assert.equal(isTamperedOrder, false);

    const isTamperedPayment = verifyPaymentSignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: "pay_tampered_999",
      razorpaySignature: validSignature,
      secretOverride: secret,
    });
    assert.equal(isTamperedPayment, false);

    const isForgedSig = verifyPaymentSignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      secretOverride: secret,
    });
    assert.equal(isForgedSig, false);
  });
});

test("Customer Payment Flow - Razorpay Webhook Signature Verification", async (t) => {
  const webhookSecret = "webhook_secret_key_54321";
  const rawBody = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_test_abc",
          order_id: "order_test_xyz",
          amount: 50000,
          status: "captured",
        },
      },
    },
  });

  const validWebhookSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  await t.test("Valid webhook signature passes verification", () => {
    const verified = verifyWebhookSignature(rawBody, validWebhookSig, webhookSecret);
    assert.equal(verified, true);
  });

  await t.test("Modified webhook payload fails verification", () => {
    const tamperedBody = rawBody.replace("50000", "10000");
    const verified = verifyWebhookSignature(tamperedBody, validWebhookSig, webhookSecret);
    assert.equal(verified, false);
  });
});

test("Customer Payment Flow - Public Config & Route Settlement Safeguards", async (t) => {
  await t.test("getPublicPaymentConfig returns configured key and active currency", () => {
    const config = getPublicPaymentConfig();
    assert.ok(typeof config.keyId === "string");
    assert.equal(config.currency, "INR");
    assert.ok(typeof config.isConfigured === "boolean");
    assert.ok(typeof config.isTestMode === "boolean");
  });
});
