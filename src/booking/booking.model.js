import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number, // minutes
      required: true,
    },
    serviceType: {
      type: String,
      default: "general",
    },
    isGroupBooking: {
      type: Boolean,
      default: false,
    },
    guestCount: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["scheduled", "in-progress", "completed", "cancelled"],
      default: "scheduled",
    },
    extendedTime: {
      type: Number, // total extra minutes added
      default: 0,
    },
    extraCharge: {
      type: Number, // total extra cost
      default: 0,
    },
    notes: {
      type: String,
      default: "",
    },
    delayMinutes: {
      type: Number, // how much this booking was delayed by others
      default: 0,
    },
    delayAccepted: {
      type: Boolean,
      default: null, // null = pending, true = accepted, false = cancelled
    },
    pricingLabel: {
      type: String,
      default: "",
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
bookingSchema.index({ businessId: 1, startTime: 1 });
bookingSchema.index({ businessId: 1, userId: 1, startTime: 1 });
bookingSchema.index({ businessId: 1, status: 1, startTime: 1 }); // for filtered status queries
bookingSchema.index({ businessId: 1, extendedTime: 1, createdAt: 1 }); // for AI buffer history
bookingSchema.index({ userId: 1, status: 1 }); // for getMyBookings

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
