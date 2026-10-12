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

test("Customer Flow - Multi-Service & Doctor/Barber Auto-Fallback Assignment", async (t) => {
  const { createBooking } = await import("../src/booking/booking.service.js");
  const Business = (await import("../src/modules/business/business.model.js")).default;
  const Booking = (await import("../src/booking/booking.model.js")).default;
  const User = (await import("../src/modules/auth/auth.model.js")).default;
  const mongoose = (await import("mongoose")).default;

  const businessId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  await t.test("Calculates total duration and price for multiple services and assigns available staff", async () => {
    const origFindById = Business.findById;
    Business.findById = async () => ({
      _id: businessId,
      name: "City Care Clinic",
      category: "clinic",
      basePrice: 100,
      staff: [
        { name: "Dr. Sarah Jenkins", role: "General Physician", specialties: "Family Medicine", isAvailable: true },
        { name: "Dr. Rajesh Gupta", role: "Cardiologist", specialties: "Cardiology", isAvailable: true },
      ],
    });

    const origUserFindById = User.findById;
    User.findById = async () => ({ _id: userId, walletBalance: 1500 });

    const origUserFindOneAndUpdate = User.findOneAndUpdate;
    User.findOneAndUpdate = () => ({
      select: async () => ({ _id: userId, walletBalance: 900 }),
    });

    const origBookingFindOne = Booking.findOne;
    Booking.findOne = async () => null; // No conflicts

    const origBookingCount = Booking.countDocuments;
    Booking.countDocuments = async () => 0;

    const origBookingCreate = Booking.create;
    let createdPayload = null;
    Booking.create = async (payload) => {
      createdPayload = payload;
      return {
        ...payload,
        populate: async () => payload,
      };
    };

    try {
      const result = await createBooking({
        businessId,
        userId,
        startTime: "2026-10-14T10:00:00Z",
        services: [
          { name: "General Consultation", duration: 15, price: 400 },
          { name: "Diagnostic Blood Test", duration: 10, price: 200 },
        ],
        preferredStaff: "Dr. Rajesh Gupta",
      });

      assert.ok(createdPayload);
      assert.equal(createdPayload.duration, 25, "Duration should sum to 15 + 10 = 25");
      assert.equal(createdPayload.paidAmount, 600, "Paid amount should sum to 400 + 200 = 600");
      assert.equal(createdPayload.services.length, 2);
      assert.equal(createdPayload.serviceType, "General Consultation + Diagnostic Blood Test");
      assert.equal(createdPayload.assignedStaff.name, "Dr. Rajesh Gupta");
      assert.equal(createdPayload.assignedStaff.autoAssigned, false);
    } finally {
      Business.findById = origFindById;
      User.findById = origUserFindById;
      User.findOneAndUpdate = origUserFindOneAndUpdate;
      Booking.findOne = origBookingFindOne;
      Booking.countDocuments = origBookingCount;
      Booking.create = origBookingCreate;
    }
  });

  await t.test("Auto-assigns to General Physician if preferred doctor is unavailable/booked", async () => {
    const origFindById = Business.findById;
    Business.findById = async () => ({
      _id: businessId,
      name: "City Care Clinic",
      category: "clinic",
      basePrice: 100,
      staff: [
        { name: "Dr. Sarah Jenkins", role: "General Physician", specialties: "Family Medicine", isAvailable: true },
        { name: "Dr. Rajesh Gupta", role: "Cardiologist", specialties: "Cardiology", isAvailable: false }, // Off-duty
      ],
    });

    const origUserFindById = User.findById;
    User.findById = async () => ({ _id: userId, walletBalance: 1500 });

    const origUserFindOneAndUpdate = User.findOneAndUpdate;
    User.findOneAndUpdate = () => ({
      select: async () => ({ _id: userId, walletBalance: 1100 }),
    });

    const origBookingFindOne = Booking.findOne;
    Booking.findOne = async () => null;

    const origBookingCount = Booking.countDocuments;
    Booking.countDocuments = async () => 0;

    const origBookingCreate = Booking.create;
    let createdPayload = null;
    Booking.create = async (payload) => {
      createdPayload = payload;
      return {
        ...payload,
        populate: async () => payload,
      };
    };

    try {
      // Customer preferred Dr. Rajesh Gupta (who is off-duty)
      const result = await createBooking({
        businessId,
        userId,
        startTime: "2026-10-14T10:00:00Z",
        services: [
          { name: "General Consultation", duration: 15, price: 400 },
        ],
        preferredStaff: "Dr. Rajesh Gupta",
      });

      assert.ok(createdPayload);
      assert.equal(createdPayload.assignedStaff.name, "Dr. Sarah Jenkins", "Should fallback to available General Physician");
      assert.equal(createdPayload.assignedStaff.autoAssigned, true, "Should mark as auto-assigned fallback");
    } finally {
      Business.findById = origFindById;
      User.findById = origUserFindById;
      User.findOneAndUpdate = origUserFindOneAndUpdate;
      Booking.findOne = origBookingFindOne;
      Booking.countDocuments = origBookingCount;
      Booking.create = origBookingCreate;
    }
  });

  await t.test("Auto-assigns to any available Barber in salon when none specified or preferred is busy", async () => {
    const origFindById = Business.findById;
    Business.findById = async () => ({
      _id: businessId,
      name: "Urban Fade Salon",
      category: "salon",
      basePrice: 200,
      staff: [
        { name: "Alex Rivera", role: "Master Barber", specialties: "Fades", isAvailable: true },
      ],
    });

    const origUserFindById = User.findById;
    User.findById = async () => ({ _id: userId, walletBalance: 1500 });

    const origUserFindOneAndUpdate = User.findOneAndUpdate;
    User.findOneAndUpdate = () => ({
      select: async () => ({ _id: userId, walletBalance: 1100 }),
    });

    const origBookingFindOne = Booking.findOne;
    Booking.findOne = async () => null;

    const origBookingCount = Booking.countDocuments;
    Booking.countDocuments = async () => 0;

    const origBookingCreate = Booking.create;
    let createdPayload = null;
    Booking.create = async (payload) => {
      createdPayload = payload;
      return {
        ...payload,
        populate: async () => payload,
      };
    };

    try {
      const result = await createBooking({
        businessId,
        userId,
        startTime: "2026-10-14T11:00:00Z",
        services: [
          { name: "Haircut", duration: 25, price: 250 },
          { name: "Beard Trim", duration: 15, price: 150 },
        ],
        preferredStaff: "any",
      });

      assert.ok(createdPayload);
      assert.equal(createdPayload.duration, 40);
      assert.equal(createdPayload.paidAmount, 400);
      assert.equal(createdPayload.assignedStaff.name, "Alex Rivera");
      assert.equal(createdPayload.assignedStaff.autoAssigned, true);
    } finally {
      Business.findById = origFindById;
      User.findById = origUserFindById;
      User.findOneAndUpdate = origUserFindOneAndUpdate;
      Booking.findOne = origBookingFindOne;
      Booking.countDocuments = origBookingCount;
      Booking.create = origBookingCreate;
    }
  });
});
