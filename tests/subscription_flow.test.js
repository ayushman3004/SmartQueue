import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import {
  SUBSCRIPTION_PLANS,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  getCurrentSubscription,
} from "../src/modules/subscription/subscription.service.js";
import User from "../src/modules/auth/auth.model.js";
import Business from "../src/modules/business/business.model.js";
import Queue from "../src/queue/queue.model.js";
import mongoose from "mongoose";

test("Subscription Flow - Plan Specifications & Pricing", async (t) => {
  await t.test("Basic Plan is priced at ₹999 with 30-day duration", () => {
    const basic = SUBSCRIPTION_PLANS.BASIC;
    assert.ok(basic);
    assert.equal(basic.price, 999);
    assert.equal(basic.amountInPaise, 99900);
    assert.equal(basic.durationDays, 30);
    assert.ok(basic.features.length >= 4);
  });

  await t.test("Pro Plan is priced at ₹1,999 with 30-day duration", () => {
    const pro = SUBSCRIPTION_PLANS.PRO;
    assert.ok(pro);
    assert.equal(pro.price, 1999);
    assert.equal(pro.amountInPaise, 199900);
    assert.equal(pro.durationDays, 30);
    assert.ok(pro.features.length >= 5);
  });
});

test("Subscription Flow - Order Creation & Role Security", async (t) => {
  const origFindById = User.findById;

  try {
    await t.test("Rejects subscription order for customer role", async () => {
      User.findById = async () => ({
        _id: "user_customer_1",
        role: "customer",
      });

      await assert.rejects(
        () => createSubscriptionOrder("user_customer_1", "BASIC"),
        /business owners/
      );
    });

    await t.test("Rejects invalid plan names", async () => {
      User.findById = async () => ({
        _id: "user_owner_1",
        role: "owner",
        email: "owner@test.com",
        name: "Owner Test",
      });

      await assert.rejects(
        () => createSubscriptionOrder("user_owner_1", "ULTRA_TIER"),
        /Invalid plan selected/
      );
    });

    await t.test("Creates mock/verified order for Basic Plan (₹999)", async () => {
      User.findById = async () => ({
        _id: "user_owner_1",
        role: "owner",
        email: "owner@test.com",
        name: "Owner Test",
      });

      const res = await createSubscriptionOrder("user_owner_1", "BASIC");
      assert.ok(res.order);
      assert.equal(res.order.amount, 99900);
      assert.equal(res.plan.id, "BASIC");
      assert.equal(res.plan.price, 999);
    });

    await t.test("Creates mock/verified order for Pro Plan (₹1,999)", async () => {
      User.findById = async () => ({
        _id: "user_owner_1",
        role: "owner",
        email: "owner@test.com",
        name: "Owner Test",
      });

      const res = await createSubscriptionOrder("user_owner_1", "PRO");
      assert.ok(res.order);
      assert.equal(res.order.amount, 199900);
      assert.equal(res.plan.id, "PRO");
      assert.equal(res.plan.price, 1999);
    });
  } finally {
    User.findById = origFindById;
  }
});

test("Subscription Flow - Payment Verification & Plan Activation", async (t) => {
  const origUserFindById = User.findById;
  const origBusinessUpdateMany = Business.updateMany;

  try {
    await t.test("Successfully verifies mock subscription payment and updates user & businesses", async () => {
      let savedUser = null;
      let updatedBusinessesFilter = null;
      let updatedBusinessesSet = null;

      const mockOwner = {
        _id: "owner_12345",
        name: "Salon Owner",
        email: "salon@serveq.tech",
        role: "owner",
        subscription: { plan: "NONE", status: "INACTIVE" },
        save: async function () {
          savedUser = this;
        },
      };

      User.findById = async () => mockOwner;
      Business.updateMany = async (filter, update) => {
        updatedBusinessesFilter = filter;
        updatedBusinessesSet = update;
        return { modifiedCount: 2 };
      };

      const result = await verifySubscriptionPayment("owner_12345", {
        plan: "PRO",
        razorpayOrderId: "order_mock_sub_9988",
        razorpayPaymentId: "pay_mock_sub_7766",
        razorpaySignature: "mock_signature_verified",
      });

      assert.ok(result);
      assert.equal(result.subscription.plan, "PRO");
      assert.equal(result.subscription.status, "ACTIVE");
      assert.equal(result.subscription.amount, 1999);
      assert.ok(result.subscription.activatedAt);
      assert.ok(result.subscription.expiresAt);

      assert.equal(savedUser.subscription.plan, "PRO");
      assert.equal(updatedBusinessesSet.$set["subscription.plan"], "PRO");
      assert.equal(updatedBusinessesSet.$set["subscription.status"], "ACTIVE");
    });
  } finally {
    User.findById = origUserFindById;
    Business.updateMany = origBusinessUpdateMany;
  }
});

test("Subscription Flow - Get Current Subscription", async (t) => {
  const origUserFindById = User.findById;

  try {
    await t.test("Returns current plan and expiration status", async () => {
      const mockOwner = {
        _id: "owner_12345",
        subscription: {
          plan: "BASIC",
          status: "ACTIVE",
          amount: 999,
          expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days ahead
        },
      };

      User.findById = async () => mockOwner;

      const result = await getCurrentSubscription("owner_12345");
      assert.equal(result.subscription.plan, "BASIC");
      assert.equal(result.subscription.status, "ACTIVE");
      assert.equal(result.currentPlan.price, 999);
      assert.ok(result.availablePlans.BASIC);
      assert.ok(result.availablePlans.PRO);
    });
  } finally {
    User.findById = origUserFindById;
  }
});

test("Subscription Flow - Venue Subscription Enforcement & Pay-at-Counter Safeguards", async (t) => {
  const origBusinessFindById = Business.findById;
  const origUserFindById = User.findById;
  const origQueueFindOne = Queue.findOne;

  const testBizId = new mongoose.Types.ObjectId();
  const testUserId = new mongoose.Types.ObjectId();

  try {
    Queue.findOne = async () => ({
      businessId: testBizId,
      users: [],
    });

    const unsubscribedBiz = {
      _id: testBizId,
      name: "Unsubscribed Salon",
      isOpen: true,
      isActive: true,
      subscription: {
        plan: "NONE",
        status: "INACTIVE",
      },
      bookingSettings: { enableAppointments: true },
      queueSettings: { enableLiveQueue: true },
    };

    const subscribedBiz = {
      _id: testBizId,
      name: "Subscribed Salon",
      isOpen: true,
      isActive: true,
      subscription: {
        plan: "BASIC",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      bookingSettings: { enableAppointments: true },
      queueSettings: { enableLiveQueue: true },
      staff: [{ name: "Alice", isAvailable: true }],
      services: [{ name: "Haircut", duration: 30, price: 300 }],
    };

    await t.test("isBusinessSubscriptionActive correctly evaluates active vs inactive", async () => {
      const { isBusinessSubscriptionActive } = await import("../src/modules/subscription/subscription.service.js");
      assert.equal(await isBusinessSubscriptionActive(unsubscribedBiz), false);
      assert.equal(await isBusinessSubscriptionActive(subscribedBiz), true);
    });

    await t.test("getAvailableSlots rejects with 403 if venue subscription is inactive", async () => {
      const { getAvailableSlots } = await import("../src/booking/booking.service.js");
      Business.findById = async () => unsubscribedBiz;

      await assert.rejects(
        () => getAvailableSlots(testBizId, new Date()),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /subscription is inactive/i);
          return true;
        }
      );
    });

    await t.test("createBooking rejects with 403 if venue subscription is inactive", async () => {
      const { createBooking } = await import("../src/booking/booking.service.js");
      Business.findById = async () => unsubscribedBiz;

      await assert.rejects(
        () =>
          createBooking({
            businessId: testBizId,
            userId: testUserId,
            startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
            services: [{ name: "Consultation", duration: 15, price: 200 }],
            paymentMethod: "counter",
          }),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /subscription is inactive/i);
          return true;
        }
      );
    });

    await t.test("joinQueue rejects with 403 if venue subscription is inactive", async () => {
      const { joinQueue } = await import("../src/queue/queue.service.js");
      Business.findById = async () => unsubscribedBiz;

      await assert.rejects(
        () =>
          joinQueue(testBizId, {
            userId: testUserId,
            services: [{ name: "Haircut", duration: 20, price: 200 }],
            paymentMethod: "counter",
          }),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /subscription is inactive/i);
          return true;
        }
      );
    });
  } finally {
    Business.findById = origBusinessFindById;
    User.findById = origUserFindById;
    Queue.findOne = origQueueFindOne;
  }
});
