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
import { getBusinessDate } from "../src/utils/bookingDates.js";
import SubscriptionOrder from "../src/modules/subscription/subscription-order.model.js";
import { getRazorpayClient } from "../src/modules/payment/razorpay.service.js";

test("Subscription Flow - Plan Specifications & Pricing", async (t) => {
  await t.test("Basic Plan is priced at ₹799 with 30-day duration", () => {
    const basic = SUBSCRIPTION_PLANS.BASIC;
    assert.ok(basic);
    assert.equal(basic.price, 799);
    assert.equal(basic.amountInPaise, 79900);
    assert.equal(basic.durationDays, 30);
    assert.ok(basic.features.length >= 4);
  });

  await t.test("Pro Plan is priced at ₹1,499 with 30-day duration", () => {
    const pro = SUBSCRIPTION_PLANS.PRO;
    assert.ok(pro);
    assert.equal(pro.price, 1499);
    assert.equal(pro.amountInPaise, 149900);
    assert.equal(pro.durationDays, 30);
    assert.ok(pro.features.length >= 5);
  });
});

test("Subscription checkout creates real orders, binds payments, and retries without extending twice", async (t) => {
  const savedEnv = { NODE_ENV: process.env.NODE_ENV, RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET };
  process.env.NODE_ENV = "production";
  process.env.RAZORPAY_KEY_ID = "rzp_test_subscriptionunit";
  process.env.RAZORPAY_KEY_SECRET = "subscription-unit-secret";
  const client = getRazorpayClient();
  const originals = { user: User.findById, update: Business.updateMany, create: SubscriptionOrder.create, find: SubscriptionOrder.findOne, activate: SubscriptionOrder.findOneAndUpdate, order: client.orders.create, payment: client.payments.fetch };
  t.after(() => {
    User.findById = originals.user; Business.updateMany = originals.update;
    SubscriptionOrder.create = originals.create; SubscriptionOrder.findOne = originals.find; SubscriptionOrder.findOneAndUpdate = originals.activate;
    client.orders.create = originals.order; client.payments.fetch = originals.payment;
    for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });
  const user = { _id: "owner_test", role: "owner", subscription: { plan: "BASIC", status: "ACTIVE", expiresAt: new Date(Date.now() + 86400000) }, async save() {} };
  let purchase;
  let cascade;
  let paymentStatus = "captured";
  User.findById = async () => user;
  Business.updateMany = async (filter, update) => { cascade = update.$set; };
  client.orders.create = async (options) => ({ id: "order_sub_real", ...options });
  client.payments.fetch = async () => ({ id: "pay_sub_real", order_id: "order_sub_real", amount: 79900, currency: "INR", status: paymentStatus });
  SubscriptionOrder.create = async (data) => { purchase = { _id: "purchase_1", ...data }; return purchase; };
  SubscriptionOrder.findOne = async (filter) => filter.owner === purchase.owner ? purchase : null;
  SubscriptionOrder.findOneAndUpdate = async (_filter, update) => Object.assign(purchase, update.$set);
  const sign = (order, payment) => crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${order}|${payment}`).digest("hex");
  const payload = { plan: "BASIC", razorpayOrderId: "order_sub_real", razorpayPaymentId: "pay_sub_real", razorpaySignature: sign("order_sub_real", "pay_sub_real") };
  await t.test("creates a persisted order using the catalog amount", async () => {
    const result = await createSubscriptionOrder(user._id, "basic");
    assert.equal(result.order.id, "order_sub_real"); assert.equal(result.order.amount, 79900); assert.equal(purchase.owner, user._id);
  });
  await t.test("rejects mock signatures and a plan that does not match the purchase", async () => {
    await assert.rejects(() => verifySubscriptionPayment(user._id, { ...payload, razorpaySignature: "mock_signature_verified" }), /signature/);
    await assert.rejects(() => verifySubscriptionPayment(user._id, { ...payload, plan: "PRO" }), /does not match/);
  });
  await t.test("rejects another owner's order", async () => {
    const owner = purchase.owner;
    purchase.owner = "another_owner";
    await assert.rejects(() => verifySubscriptionPayment(user._id, payload), /does not match/);
    purchase.owner = owner;
  });
  await t.test("does not activate an uncaptured payment", async () => {
    paymentStatus = "authorized";
    await assert.rejects(() => verifySubscriptionPayment(user._id, payload), /not yet confirmed/);
    assert.equal(purchase.activatedAt, undefined);
    paymentStatus = "captured";
  });
  await t.test("renewal preserves remaining days and duplicate verification is idempotent", async () => {
    const previousExpiry = new Date(user.subscription.expiresAt).getTime();
    const result = await verifySubscriptionPayment(user._id, payload);
    assert.equal(new Date(result.subscription.expiresAt).getTime(), previousExpiry + 30 * 86400000);
    const expiry = new Date(result.subscription.expiresAt).getTime();
    await verifySubscriptionPayment(user._id, payload);
    assert.equal(new Date(user.subscription.expiresAt).getTime(), expiry);
    assert.equal(cascade["subscription.plan"], "BASIC");
  });
  await t.test("activation can retry a failed business sync without extending again", async () => {
    const expiry = new Date(user.subscription.expiresAt).getTime();
    Business.updateMany = async () => { throw new Error("temporary database error"); };
    await assert.rejects(() => verifySubscriptionPayment(user._id, payload), /database error/);
    Business.updateMany = async (_filter, update) => { cascade = update.$set; };
    await verifySubscriptionPayment(user._id, payload);
    assert.equal(new Date(user.subscription.expiresAt).getTime(), expiry);
  });
  await t.test("honors the recorded amount for orders created before the price change", async () => {
    const oldPurchase = { ...purchase };
    const oldSubscription = user.subscription;
    purchase.amount = 99900;
    purchase.activatedAt = null;
    purchase.paymentId = undefined;
    client.payments.fetch = async () => ({ order_id: purchase.orderId, amount: 99900, currency: "INR", status: "captured" });
    const result = await verifySubscriptionPayment(user._id, payload);
    assert.equal(result.subscription.amount, 999);
    purchase = oldPurchase;
    user.subscription = oldSubscription;
  });
  await t.test("payment provider failure never returns a mock order", async () => {
    client.orders.create = async () => { throw new Error("provider down"); };
    await assert.rejects(() => createSubscriptionOrder(user._id, "PRO"), /Unable to create/);
  });
  await t.test("reports provider authentication failures without revealing credentials", async () => {
    client.orders.create = async () => { throw { statusCode: 401, error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" } }; };
    await assert.rejects(() => createSubscriptionOrder(user._id, "PRO"), (error) => {
      assert.equal(error.statusCode, 502);
      assert.match(error.message, /authentication failed/i);
      assert.ok(!error.message.includes(process.env.RAZORPAY_KEY_SECRET));
      return true;
    });
  });
  await t.test("rejects customer access and checkout without configured credentials", async () => {
    user.role = "customer";
    await assert.rejects(() => createSubscriptionOrder(user._id, "BASIC"), /Only registered/);
    user.role = "owner";
    delete process.env.RAZORPAY_KEY_SECRET;
    await assert.rejects(() => createSubscriptionOrder(user._id, "BASIC"), /unavailable/);
  });
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
          amount: 799,
          expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days ahead
        },
      };

      User.findById = async () => mockOwner;

      const result = await getCurrentSubscription("owner_12345");
      assert.equal(result.subscription.plan, "BASIC");
      assert.equal(result.subscription.status, "ACTIVE");
      assert.equal(result.currentPlan.price, 799);
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
        () => getAvailableSlots(testBizId, getBusinessDate(new Date())),
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

test("Subscription Flow - Live Queue Counter Payment & AI Insights Plan Gating", async (t) => {
  const { collectQueuePayment } = await import("../src/queue/queue.service.js");
  const { getBusinessAnalytics } = await import("../src/modules/analytics/analytics.service.js");
  const Booking = (await import("../src/booking/booking.model.js")).default;

  const testBizId = new mongoose.Types.ObjectId().toString();
  const testOwnerId = new mongoose.Types.ObjectId().toString();
  const testUserId = new mongoose.Types.ObjectId().toString();
  const testStaffId = new mongoose.Types.ObjectId().toString();
  const testBookingId = new mongoose.Types.ObjectId().toString();

  await t.test("collectQueuePayment updates both queue entry and linked booking to paid", async () => {
    let savedQueue = false;
    let savedBooking = false;

    const mockQueueDoc = {
      businessId: testBizId,
      users: [
        {
          userId: testUserId,
          bookingId: testBookingId,
          serviceType: "Haircut",
          paidAmount: 350,
          paymentMethod: "counter",
          paymentStatus: "pending",
          status: "waiting",
        },
      ],
      save: async () => {
        savedQueue = true;
      },
    };

    const mockBookingDoc = {
      _id: testBookingId,
      paymentMethod: "counter",
      paymentStatus: "pending",
      paidAmount: 350,
      save: async () => {
        savedBooking = true;
      },
    };

    const origBizFind = Business.findById;
    const origQueueFind = Queue.findOne;
    const origBookingFind = Booking.findById;

    try {
      Business.findById = async () => ({
        _id: testBizId,
        owner: testOwnerId,
        ownerId: testOwnerId,
      });

      Queue.findOne = () => ({
        ...mockQueueDoc,
        users: mockQueueDoc.users,
        save: mockQueueDoc.save,
        populate: function () {
          return this;
        },
        then: function (resolve) {
          resolve(mockQueueDoc);
        },
      });

      Booking.findById = async () => mockBookingDoc;

      const result = await collectQueuePayment(
        testBizId,
        testUserId,
        { _id: testOwnerId, role: "owner" },
        null
      );

      assert.equal(result.users[0].paymentStatus, "paid");
      assert.equal(mockQueueDoc.users[0].paymentStatus, "paid");
      assert.equal(mockBookingDoc.paymentStatus, "paid");
      assert.equal(savedQueue, true);
      assert.equal(savedBooking, true);
    } finally {
      Business.findById = origBizFind;
      Queue.findOne = origQueueFind;
      Booking.findById = origBookingFind;
    }
  });

  await t.test("getBusinessAnalytics restricts AI insights for Basic plan (isLocked: true)", async () => {
    const origBizFind = Business.findById;
    const origUserFind = User.findById;
    const origBookingFind = Booking.find;
    const origBookingCount = Booking.countDocuments;
    const Review = (await import("../src/modules/review/review.model.js")).default;
    const origReviewFind = Review.find;
    const origQueueFind = Queue.findOne;

    try {
      Business.findById = async () => ({
        _id: testBizId,
        owner: testOwnerId,
        name: "Basic Salon",
        category: "salon",
        subscription: {
          plan: "BASIC",
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 864000000),
        },
      });

      User.findById = async () => ({
        _id: testOwnerId,
        role: "owner",
        subscription: {
          plan: "BASIC",
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 864000000),
        },
      });

      Booking.countDocuments = async () => 0;
      Booking.find = () => ({
        populate: () => ({
          sort: async () => [],
        }),
      });

      Review.find = () => ({
        sort: () => ({
          limit: async () => [],
        }),
      });

      Queue.findOne = () => ({
        populate: async () => null,
      });

      const analytics = await getBusinessAnalytics(testBizId, testOwnerId, "owner", { refresh: false });

      assert.ok(analytics.aiInsights);
      assert.equal(analytics.aiInsights.isLocked, true);
      assert.equal(analytics.aiInsights.restricted, true);
      assert.equal(analytics.aiInsights.requiredPlan, "PRO");
      assert.equal(analytics.aiInsights.currentPlan, "BASIC");
    } finally {
      Business.findById = origBizFind;
      User.findById = origUserFind;
      Booking.find = origBookingFind;
      Booking.countDocuments = origBookingCount;
      Review.find = origReviewFind;
      Queue.findOne = origQueueFind;
    }
  });

  await t.test("getBusinessAnalytics rejects AI refresh with 403 when not on Pro plan", async () => {
    const origBizFind = Business.findById;
    const origUserFind = User.findById;
    const origBookingFind = Booking.find;
    const origBookingCount = Booking.countDocuments;
    const Review = (await import("../src/modules/review/review.model.js")).default;
    const origReviewFind = Review.find;

    try {
      Business.findById = async () => ({
        _id: testBizId,
        owner: testOwnerId,
        subscription: { plan: "BASIC", status: "ACTIVE" },
      });

      User.findById = async () => ({
        _id: testOwnerId,
        role: "owner",
        subscription: { plan: "BASIC", status: "ACTIVE" },
      });

      Booking.countDocuments = async () => 0;
      Booking.find = () => ({
        populate: () => ({
          sort: async () => [],
        }),
      });

      Review.find = () => ({
        sort: () => ({
          limit: async () => [],
        }),
      });

      await assert.rejects(
        () =>
          getBusinessAnalytics(testBizId, testOwnerId, "owner", { refresh: true }),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /Pro Plan/i);
          return true;
        }
      );
    } finally {
      Business.findById = origBizFind;
      User.findById = origUserFind;
      Booking.find = origBookingFind;
      Booking.countDocuments = origBookingCount;
      Review.find = origReviewFind;
    }
  });

  await t.test("getBusinessAnalytics unlocks AI insights for Pro plan subscribers", async () => {
    const origBizFind = Business.findById;
    const origUserFind = User.findById;
    const origBookingFind = Booking.find;
    const origBookingCount = Booking.countDocuments;
    const Review = (await import("../src/modules/review/review.model.js")).default;
    const origReviewFind = Review.find;
    const origQueueFind = Queue.findOne;

    try {
      Business.findById = async () => ({
        _id: testBizId,
        owner: testOwnerId,
        name: "Pro Salon",
        category: "salon",
        subscription: {
          plan: "PRO",
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 864000000),
        },
      });

      User.findById = async () => ({
        _id: testOwnerId,
        role: "owner",
        subscription: {
          plan: "PRO",
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 864000000),
        },
      });

      Booking.countDocuments = async () => 0;
      Booking.find = () => ({
        populate: () => ({
          sort: async () => [],
        }),
      });

      Review.find = () => ({
        sort: () => ({
          limit: async () => [],
        }),
      });

      Queue.findOne = () => ({
        populate: async () => null,
      });

      const analytics = await getBusinessAnalytics(testBizId, testOwnerId, "owner", { refresh: false });

      assert.ok(analytics.aiInsights);
      assert.equal(analytics.aiInsights.isLocked, false);
      assert.equal(analytics.aiInsights.restricted, false);
      assert.ok(analytics.aiInsights.peakHours);
      assert.ok(analytics.aiInsights.bestCustomer);
      assert.ok(analytics.aiInsights.bestEmployee);
    } finally {
      Business.findById = origBizFind;
      User.findById = origUserFind;
      Booking.find = origBookingFind;
      Booking.countDocuments = origBookingCount;
      Review.find = origReviewFind;
      Queue.findOne = origQueueFind;
    }
  });
});
