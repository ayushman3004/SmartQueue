import mongoose from "mongoose";

const prelaunchCustomerSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Please enter a valid email address"],
    },
    role: {
      type: String,
      default: "prelaunch_customer",
    },
    tag: {
      type: String,
      default: "prelaunch_customer",
    },
    status: {
      type: String,
      default: "confirmed",
    },
    confirmationEmailSent: {
      type: Boolean,
      default: false,
    },
    confirmationMessageId: {
      type: String,
      default: "",
    },
    source: {
      type: String,
      default: "coming_soon_landing",
    },
    ip: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "prelaunch_customers",
  }
);

const PrelaunchCustomer =
  mongoose.models.PrelaunchCustomer ||
  mongoose.model("PrelaunchCustomer", prelaunchCustomerSchema);

export const Waitlist = PrelaunchCustomer;
export default PrelaunchCustomer;
