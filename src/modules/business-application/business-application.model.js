import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      required: true,
    },
    ownerName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phone: String,
    businessCategory: {
      type: String,
      enum: ["salon", "clinic", "healthcare", "other"],
    },
    businessAddress: String,
    city: String,
    description: String,
    employees: Number,
    website: String,
    comments: String,
    privacyAcknowledgedAt: Date,
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: Date,
    rejectedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewNotes: String,
    linkedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    linkedHubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
    },
    invitation: {
      generation: String,
      issuedAt: Date,
      expiresAt: Date,
      activatedAt: Date,
      delivery: {
        type: String,
        enum: ["PENDING", "SENT", "FAILED"],
      },
      deliveredAt: Date,
    },
    audit: [
      {
        action: String,
        at: Date,
        actor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);
schema.index(
  {
    email: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: ["PENDING", "APPROVED"],
      },
    },
  },
);
export default mongoose.model("BusinessApplication", schema);
