import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '5m' }, // TTL index for automatic deletion
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
