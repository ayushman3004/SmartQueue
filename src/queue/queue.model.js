import mongoose from "mongoose";

const queueSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
    },
    users: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
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
      },
    ],
  },
  { timestamps: true }
);

const Queue = mongoose.model("Queue", queueSchema);
export default Queue;
