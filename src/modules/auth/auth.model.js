import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      select: false, // don't return password by default
    },
    googleId: {
      type: String,
      sparse: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["customer", "owner", "admin", "doctor"],
      default: "customer",
    },
    businessCategories: { type: [String], default: [] },
    walletBalance: {
      type: Number,
      default: 0,
    },
    authProvider: {
      type: String,
      enum: ["local", "google", "both"],
      default: "local",
    },
    phone: {
      type: String,
      default: "",
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerification: {
      provider: { type: String, enum: ["firebase"] },
      phone: String,
      verifiedAt: Date,
    },
    whatsappFollowUpPhone: { type: String, default: "" },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    bio: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    tokenVersion: { type: Number, default: 0 },
    doctorAccess: {
      businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business" },
      staffId: mongoose.Schema.Types.ObjectId,
      doctorId: String,
      status: { type: String, enum: ["ACTIVE", "REVOKED"] },
      mustChangePassword: Boolean,
      invitationDelivery: { type: String, enum: ["SENT", "FAILED", "DELIVERED", "BOUNCED", "DELAYED"] },
      invitationResendId: String,
    },
    ownerAccess: {
      applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessApplication" },
      status: { type: String, enum: ["INVITED", "ACTIVE", "EXPIRED", "SUSPENDED"] },
      activationTokenHash: { type: String, select: false },
      invitationIssuedAt: Date, invitationExpiresAt: Date, activatedAt: Date, firstLoginAt: Date,
      mustChangePassword: { type: Boolean, default: false }, passwordChangeDeadline: Date, passwordChangedAt: Date,
    },
    subscription: {
      businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null },
      plan: {
        type: String,
        enum: ["NONE", "BASIC", "PRO"],
        default: "NONE",
      },
      status: {
        type: String,
        enum: ["INACTIVE", "ACTIVE", "EXPIRED"],
        default: "INACTIVE",
      },
      amount: {
        type: Number,
        default: 0,
      },
      activatedAt: {
        type: Date,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      razorpayOrderId: {
        type: String,
        default: "",
      },
      razorpayPaymentId: {
        type: String,
        default: "",
      },
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
