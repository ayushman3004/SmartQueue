import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      index: true,
    },
    otp: String,
    challenge: String,
    accountTokenVersion: Number,
    purpose: {
      type: String,
      enum: [
        "forgot_password",
        "email_verification",
      ],
      default: "forgot_password",
    },
    ownerTokenVersion: Number,
    resetToken: {
      type: String,
      sparse: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: "10m" }, // TTL index for automatic deletion after expiry
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastResentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const Otp = mongoose.model("Otp", otpSchema);
export default Otp;
