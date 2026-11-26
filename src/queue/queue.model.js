import mongoose from "mongoose";

const queueSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
    },
    autoCompletionLeaseUntil: { type: Date, default: null },
    users: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        bookingId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Booking",
          default: null,
        },
        walkIn: { type: Boolean },
        status: {
          type: String,
          enum: ["waiting", "serving", "done"],
          default: "waiting",
        },
        serviceTime: {
          type: Number,
          default: 10,
        },
        serviceType: {
          type: String,
          default: "general",
        },
        services: [
          {
            name: { type: String },
            duration: { type: Number },
            price: { type: Number, default: 0 },
          },
        ],
        serviceStep: { type: Number, min: 0 },
        assignedStaff: {
          staffId: { type: mongoose.Schema.Types.ObjectId },
          name: { type: String, default: "" },
          role: { type: String, default: "" },
          specialties: { type: String, default: "" },
          autoAssigned: { type: Boolean, default: false },
        },
        estimatedStartTime: {
          type: Date,
          default: null,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        pricingLabel: {
          type: String,
          default: "",
        },
        paidAmount: {
          type: Number,
          default: 0,
        },
        paymentMethod: {
          type: String,
          enum: ["counter", "online", "cash", "upi"],
          default: "counter",
        },
        paymentStatus: {
          type: String,
          enum: ["pending", "paid", "failed", "refunded"],
          default: "pending",
        },
      },
    ],
  },
  { timestamps: true, optimisticConcurrency: ['users'] }
);

const Queue = mongoose.model("Queue", queueSchema);
export default Queue;
