import test from "node:test";
import assert from "node:assert/strict";

import { MockPaymentProvider } from "../src/modules/payment/payment.provider.js";
import { validateAmount } from "../src/modules/payment/payment.service.js";
import QueueDS from "../src/queue/queue.ds.js";

test("Customer Flow - Payment Provider Abstraction & Safe Positive Amounts", async (t) => {
  await t.test("Validates positive amounts strictly", () => {
    assert.equal(validateAmount(100), 100);
    assert.equal(validateAmount("25.50"), 25.50);
    assert.throws(() => validateAmount(-50), /positive number/);
    assert.throws(() => validateAmount(0), /positive number/);
    assert.throws(() => validateAmount("invalid"), /positive number/);
  });

  await t.test("MockPaymentProvider creates verifiable payment orders", async () => {
    const provider = new MockPaymentProvider();
    const order = await provider.createPaymentOrder({
      amount: 150,
      customerId: "user_test_123",
      description: "Test Booking",
    });

    assert.equal(order.success, true);
    assert.equal(order.amount, 150);
    assert.match(order.orderId, /^order_mock_/);

    const verification = await provider.verifyPayment({
      orderId: order.orderId,
      amount: 150,
    });

    assert.equal(verification.verified, true);
    assert.match(verification.paymentId, /^pay_mock_/);
  });
});

test("Customer Flow - Queue Serialization Preserves Paid Amount and Pricing Label", async (t) => {
  await t.test("QueueDS preserves pricingLabel and paidAmount across serialization", () => {
    const queue = new QueueDS();
    queue.enqueue({
      userId: "user_abc_1",
      serviceTime: 20,
      serviceType: "haircut",
      pricingLabel: "Premium Trim",
      paidAmount: 250,
    });

    queue.enqueue({
      userId: "user_xyz_2",
      serviceTime: 15,
      serviceType: "shave",
      pricingLabel: "Royal Shave",
      paidAmount: 180,
    });

    const serialized = queue.toArray();
    assert.equal(serialized.length, 2);
    assert.equal(serialized[0].pricingLabel, "Premium Trim");
    assert.equal(serialized[0].paidAmount, 250);
    assert.equal(serialized[1].pricingLabel, "Royal Shave");
    assert.equal(serialized[1].paidAmount, 180);

    // Reconstruct via fromArray
    const restored = QueueDS.fromArray(serialized);
    const restoredArray = restored.toArray();
    assert.equal(restoredArray.length, 2);
    assert.equal(restoredArray[0].pricingLabel, "Premium Trim");
    assert.equal(restoredArray[0].paidAmount, 250);
    assert.equal(restoredArray[1].pricingLabel, "Royal Shave");
    assert.equal(restoredArray[1].paidAmount, 180);
  });
});
