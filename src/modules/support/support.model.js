import mongoose from "mongoose";

const supportTicketSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Please enter a valid email address"],
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    userRole: {
      type: String,
      enum: ["customer", "owner", "admin", "guest"],
      default: "customer",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      default: null,
    },
    businessName: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    emailSentToSupport: {
      type: Boolean,
      default: false,
    },
    supportMessageId: {
      type: String,
      default: "",
    },
    ackEmailSentToUser: {
      type: Boolean,
      default: false,
    },
    ackMessageId: {
      type: String,
      default: "",
    },
    ip: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "support_tickets",
  }
);

const SupportTicket =
  mongoose.models.SupportTicket || mongoose.model("SupportTicket", supportTicketSchema);

export default SupportTicket;
