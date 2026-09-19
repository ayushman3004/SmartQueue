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
});

