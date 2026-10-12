import test from "node:test";
import assert from "node:assert/strict";

import QueueDS from "../src/queue/queue.ds.js";
import { generateBusinessAIAnalytics, predictServiceTime } from "../ai/gemini.service.js";

test("Business Flow - Queue DS FIFO and Call Next Processing", async (t) => {
  await t.test("Enqueue head starts in serving state and recalculates waiting ETAs", () => {
    const queue = new QueueDS();
    queue.enqueue({
      userId: "cust_1",
      serviceTime: 10,
      serviceType: "express",
      paidAmount: 50,
      pricingLabel: "Express",
    });

    assert.equal(queue.head.status, "serving");

    queue.enqueue({
      userId: "cust_2",
      serviceTime: 15,
      serviceType: "consultation",
      paidAmount: 100,
      pricingLabel: "Consultation",
    });

    assert.equal(queue.head.next.status, "waiting");
    assert.ok(queue.head.next.estimatedStartTime >= queue.head.estimatedStartTime);

    // Call next (dequeue)
    queue.dequeue();
    assert.equal(queue.head.userId, "cust_2");
    assert.equal(queue.head.status, "serving");
  });
});

test("Business Flow - AI Analytics Deterministic Fallback", async (t) => {
  await t.test("Generates structured analytics heuristics without external API keys", async () => {
    const analytics = await generateBusinessAIAnalytics({
      businessName: "Elite Salon",
      category: "salon",
      bookingsCount: 20,
      cancellationCount: 2,
      averageRating: 4.8,
      recentReviews: [{ comment: "Excellent cut!", rating: 5 }],
    });

    assert.ok(Array.isArray(analytics.peakHours));
    assert.ok(analytics.peakHours.length > 0);
    assert.equal(typeof analytics.cancellationRate, "string");
    assert.equal(analytics.cancellationRate, "10%");
    assert.ok(analytics.sentimentSummary.includes("Exceptional"));
    assert.ok(Array.isArray(analytics.recommendations));
  });

  await t.test("Predicts service duration with deterministic fallback", async () => {
    const duration = await predictServiceTime({
      serviceType: "healthcare",
      userType: "normal",
      timeOfDay: 11, // Peak
      queueLength: 4,
      baseDuration: 20,
    });

    assert.ok(Number.isFinite(duration));
    assert.ok(duration >= 20); // Peak multiplier and queue factor applied
  });

  await t.test("Business Model validates services catalog schema correctly", async () => {
    const Business = (await import("../src/modules/business/business.model.js")).default;
    const mongoose = (await import("mongoose")).default;

    const sample = new Business({
      name: "Downtown Barbershop",
      category: "salon",
      owner: new mongoose.Types.ObjectId(),
      services: [
        { name: "Fade Cut", duration: 25, price: 200 },
        { name: "Beard Sculpt", duration: 15, price: 120 },
      ],
      serviceTypes: ["Fade Cut", "Beard Sculpt"],
    });

    const validationError = sample.validateSync();
    assert.equal(validationError, undefined);
    assert.equal(sample.services.length, 2);
    assert.equal(sample.services[0].name, "Fade Cut");
    assert.equal(sample.services[0].duration, 25);
    assert.equal(sample.services[0].price, 200);
  });

  await t.test("getBusinessAnalytics reflects all active bookings in revenue and tracks cancelled bookings", async () => {
    const { getBusinessAnalytics } = await import("../src/modules/analytics/analytics.service.js");
    const Business = (await import("../src/modules/business/business.model.js")).default;
    const Booking = (await import("../src/booking/booking.model.js")).default;
    const Review = (await import("../src/modules/review/review.model.js")).default;
    const mongoose = (await import("mongoose")).default;

    const ownerId = new mongoose.Types.ObjectId();
    const businessId = new mongoose.Types.ObjectId();
    const custId1 = new mongoose.Types.ObjectId();
    const custId2 = new mongoose.Types.ObjectId();

    // Mock Business.findById
    const origFindById = Business.findById;
    Business.findById = async () => ({
      _id: businessId,
      name: "Hair Studio",
      category: "salon",
      owner: ownerId,
      staff: [],
    });

    // Mock Review.find
    const origReviewFind = Review.find;
    Review.find = () => ({
      sort: () => ({
        limit: async () => [],
      }),
    });

    // 1 confirmed booking (₹400) + 1 cancelled booking (₹300)
    const mockBookings = [
      {
        _id: new mongoose.Types.ObjectId(),
        businessId,
        userId: { _id: custId1, name: "Ayushman B", email: "a@test.com" },
        startTime: new Date("2026-10-13T09:00:00Z"),
        endTime: new Date("2026-10-13T09:20:00Z"),
        serviceType: "spa",
        status: "confirmed",
        paidAmount: 400,
        extraCharge: 0,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId,
        userId: { _id: custId2, name: "Other User", email: "b@test.com" },
        startTime: new Date("2026-10-13T10:00:00Z"),
        endTime: new Date("2026-10-13T10:20:00Z"),
        serviceType: "haircut",
        status: "cancelled",
        paidAmount: 300,
        extraCharge: 0,
      },
    ];

    const origCountDocuments = Booking.countDocuments;
    Booking.countDocuments = async () => mockBookings.length;

    const origBookingFind = Booking.find;
    Booking.find = () => ({
      populate: () => ({
        sort: async () => mockBookings,
      }),
    });

    try {
      const result = await getBusinessAnalytics(businessId, ownerId, "owner");

      // Verify metrics
      assert.equal(result.metrics.totalRevenue, 400, "Active confirmed booking should reflect in totalRevenue");
      assert.equal(result.metrics.activeBookings, 1, "Should count 1 active booking");
      assert.equal(result.metrics.completedBookings, 0, "0 completed bookings");
      assert.equal(result.metrics.cancelledBookings, 1, "Should count 1 cancelled booking");
      assert.equal(result.metrics.cancelledRevenue, 300, "Should track ₹300 cancelled revenue");
      assert.equal(result.metrics.customerCount, 1, "Should count 1 active unique customer");

      // Verify daily breakdown has Oct 13, 2026
      const oct13 = result.dailyBreakdown.find((d) => d.date === "2026-10-13");
      assert.ok(oct13, "Scheduled appointment date must exist in dailyBreakdown");
      assert.equal(oct13.totalBookings, 2, "2 total bookings on Oct 13");
      assert.equal(oct13.activeCount, 1, "1 active booking on Oct 13");
      assert.equal(oct13.cancelledCount, 1, "1 cancelled booking on Oct 13");
      assert.equal(oct13.cancelledRevenue, 300, "₹300 refunded on Oct 13");
      assert.equal(oct13.revenue, 400, "₹400 earned revenue on Oct 13");
      assert.equal(oct13.topService, "spa");
    } finally {
      Business.findById = origFindById;
      Review.find = origReviewFind;
      Booking.countDocuments = origCountDocuments;
      Booking.find = origBookingFind;
    }
  });
});

