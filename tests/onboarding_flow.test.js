import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Business from "../src/modules/business/business.model.js";
import * as businessService from "../src/modules/business/business.service.js";
import * as bookingService from "../src/booking/booking.service.js";
import * as queueService from "../src/queue/queue.service.js";

test("Business Onboarding Flow - Model, Steps, and Policy Enforcement", async (t) => {
  const ownerId = new mongoose.Types.ObjectId();
  const businessId = new mongoose.Types.ObjectId();

  await t.test("Business Model schema accommodates full onboarding state and safe defaults", () => {
    const biz = new Business({
      name: "Grooming Lounge",
      category: "salon",
      owner: ownerId,
    });

    const valErr = biz.validateSync();
    assert.equal(valErr, undefined);
    assert.equal(biz.onboarding.status, "COMPLETED"); // Safe default for existing businesses
    assert.equal(biz.paymentConfiguration.paymentMode, "PAY_AT_BUSINESS");
    assert.equal(biz.paymentConfiguration.onlinePaymentStatus, "NOT_STARTED");
    assert.equal(biz.bookingSettings.enableAppointments, true);
    assert.equal(biz.queueSettings.enableLiveQueue, true);
  });

  await t.test("saveOnboardingStep Step 1 validates business name", async () => {
    const fakeBiz = new Business({
      _id: businessId,
      name: "Draft Venue",
      category: "salon",
      owner: ownerId,
      onboarding: { status: "IN_PROGRESS", currentStep: 1, completedSteps: [] },
    });

    const origFindOne = Business.findOne;
    Business.findOne = async () => fakeBiz;

    try {
      await assert.rejects(
        async () => {
          await businessService.saveOnboardingStep(businessId, ownerId, 1, { name: "" });
        },
        { message: "Business name cannot be empty" }
      );

      fakeBiz.save = async () => fakeBiz;
      const updated = await businessService.saveOnboardingStep(businessId, ownerId, 1, {
        name: "Luxe Cut Salon",
        category: "salon",
        email: "contact@luxecut.com",
        phone: "+91 9876543210",
      });

      assert.equal(updated.name, "Luxe Cut Salon");
      assert.equal(updated.email, "contact@luxecut.com");
      assert.ok(updated.onboarding.completedSteps.includes(1));
    } finally {
      Business.findOne = origFindOne;
    }
  });

  await t.test("saveOnboardingStep Step 2 validates operating hours closing time after opening time", async () => {
    const fakeBiz = new Business({
      _id: businessId,
      name: "Luxe Cut Salon",
      category: "salon",
      owner: ownerId,
      onboarding: { status: "IN_PROGRESS", currentStep: 2, completedSteps: [1] },
    });
    fakeBiz.save = async () => fakeBiz;

    const origFindOne = Business.findOne;
    Business.findOne = async () => fakeBiz;

    try {
      // Invalid hours: open 20:00, close 10:00
      await assert.rejects(
        async () => {
          await businessService.saveOnboardingStep(businessId, ownerId, 2, {
            address: "123 High Street",
            city: "Bangalore",
            operatingHours: {
              timezone: "Asia/Kolkata",
              weeklySchedule: [{ day: "monday", isOpen: true, open: "20:00", close: "10:00" }],
            },
          });
        },
        /Closing time .* must be after opening time/
      );

      // Valid hours
      const updated = await businessService.saveOnboardingStep(businessId, ownerId, 2, {
        address: "123 High Street",
        city: "Bangalore",
        operatingHours: {
          timezone: "Asia/Kolkata",
          weeklySchedule: [{ day: "monday", isOpen: true, open: "09:00", close: "20:00" }],
          weeklyHolidays: ["sunday"],
        },
      });

      assert.equal(updated.locationDetails.city, "Bangalore");
      assert.equal(updated.operatingHours.timezone, "Asia/Kolkata");
      assert.ok(updated.onboarding.completedSteps.includes(2));
    } finally {
      Business.findOne = origFindOne;
    }
  });

  await t.test("saveOnboardingStep Step 3 validates service duration and price", async () => {
    const fakeBiz = new Business({
      _id: businessId,
      name: "Luxe Cut Salon",
      category: "salon",
      owner: ownerId,
      onboarding: { status: "IN_PROGRESS", currentStep: 3, completedSteps: [1, 2] },
    });
    fakeBiz.save = async () => fakeBiz;

    const origFindOne = Business.findOne;
    Business.findOne = async () => fakeBiz;

    try {
      await assert.rejects(
        async () => {
          await businessService.saveOnboardingStep(businessId, ownerId, 3, { services: [] });
        },
        { message: "Your business must have at least one service configured" }
      );

      const updated = await businessService.saveOnboardingStep(businessId, ownerId, 3, {
        services: [
          { name: "Executive Haircut", duration: 30, price: 350 },
          { name: "Beard Trim", duration: 15, price: 150 },
        ],
      });

      assert.equal(updated.services.length, 2);
      assert.equal(updated.services[0].name, "Executive Haircut");
      assert.ok(updated.onboarding.completedSteps.includes(3));
    } finally {
      Business.findOne = origFindOne;
    }
  });

  await t.test("saveOnboardingStep Step 6 allows PAY_AT_BUSINESS without blocking online payment", async () => {
    const fakeBiz = new Business({
      _id: businessId,
      name: "Luxe Cut Salon",
      category: "salon",
      owner: ownerId,
      onboarding: { status: "IN_PROGRESS", currentStep: 6, completedSteps: [1, 2, 3, 4, 5] },
    });
    fakeBiz.save = async () => fakeBiz;

    const origFindOne = Business.findOne;
    Business.findOne = async () => fakeBiz;

    try {
      const updated = await businessService.saveOnboardingStep(businessId, ownerId, 6, {
        paymentMode: "PAY_AT_BUSINESS",
        upiId: "luxecut@upi",
      });

      assert.equal(updated.paymentConfiguration.paymentMode, "PAY_AT_BUSINESS");
      assert.equal(updated.paymentConfiguration.upiId, "luxecut@upi");
      assert.ok(updated.onboarding.completedSteps.includes(6));
    } finally {
      Business.findOne = origFindOne;
    }
  });

  await t.test("launchBusiness validates pre-flight fields and marks status COMPLETED", async () => {
    const fakeBiz = new Business({
      _id: businessId,
      name: "Luxe Cut Salon",
      category: "salon",
      address: "123 High Street",
      owner: ownerId,
      services: [{ name: "Cut", duration: 20, price: 200 }],
      paymentConfiguration: { paymentMode: "PAY_AT_BUSINESS" },
      onboarding: { status: "IN_PROGRESS", currentStep: 6, completedSteps: [1, 2, 3, 4, 5, 6] },
    });
    fakeBiz.save = async () => fakeBiz;

    const origFindOne = Business.findOne;
    Business.findOne = async () => fakeBiz;

    try {
      const launched = await businessService.launchBusiness(businessId, ownerId);
      assert.equal(launched.onboarding.status, "COMPLETED");
      assert.equal(launched.isActive, true);
      assert.equal(launched.isOpen, true);
    } finally {
      Business.findOne = origFindOne;
    }
  });

  await t.test("Booking policy rejects booking when enableAppointments is false", async () => {
    const origFindById = Business.findById;
    Business.findById = async () => ({
      _id: businessId,
      name: "Queue-Only Venue",
      bookingSettings: { enableAppointments: false },
    });

    try {
      await assert.rejects(
        async () => {
          await bookingService.createBooking({
            businessId,
            userId: new mongoose.Types.ObjectId(),
            startTime: new Date(Date.now() + 86400000).toISOString(),
            serviceType: "General Service",
          });
        },
        { message: "Appointment booking is currently disabled for this business" }
      );
    } finally {
      Business.findById = origFindById;
    }
  });

  await t.test("Queue policy rejects queue join when enableLiveQueue is false", async () => {
    const origFindById = Business.findById;
    Business.findById = async () => ({
      _id: businessId,
      name: "Appointments-Only Venue",
      isOpen: true,
      isActive: true,
      queueSettings: { enableLiveQueue: false },
    });

    const Queue = mongoose.model("Queue");
    const origQueueFindOne = Queue.findOne;
    Queue.findOne = async () => ({ users: [] });

    try {
      await assert.rejects(
        async () => {
          await queueService.joinQueue(businessId, {
            userId: new mongoose.Types.ObjectId(),
            serviceType: "General Service",
          });
        },
        { message: "Live queue is currently disabled for this business" }
      );
    } finally {
      Business.findById = origFindById;
      Queue.findOne = origQueueFindOne;
    }
  });
});
