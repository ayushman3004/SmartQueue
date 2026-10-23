import mongoose from "mongoose";

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      enum: ["salon", "clinic", "healthcare", "other"],
      default: "salon",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    address: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    coordinates: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
    },
    timings: {
      open: { type: String, default: "09:00" },
      close: { type: String, default: "18:00" },
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    coverImage: {
      type: String,
      default: "",
    },
    locationDetails: {
      country: { type: String, default: "India" },
      state: { type: String, default: "" },
      city: { type: String, default: "" },
      postalCode: { type: String, default: "" },
    },
    operatingHours: {
      timezone: { type: String, default: "Asia/Kolkata" },
      weeklySchedule: [
        {
          day: { type: String, default: "" },
          isOpen: { type: Boolean, default: true },
          open: { type: String, default: "09:00" },
          close: { type: String, default: "20:00" },
        },
      ],
      weeklyHolidays: {
        type: [String],
        default: [],
      },
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "suspended"],
      default: "approved",
    },
    averageServiceTime: {
      type: Number,
      default: 10, // minutes
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    logo: {
      type: String,
      default: "",
    },
    serviceTypes: {
      type: [String],
      default: ["general"],
    },
    services: {
      type: [
        {
          name: { type: String, required: true },
          duration: { type: Number, required: true },
          price: { type: Number, default: 0 },
          description: { type: String, default: "" },
          category: { type: String, default: "" },
          isAvailable: { type: Boolean, default: true },
          assignedStaff: { type: [String], default: [] },
        },
      ],
      default: [{ name: "general", duration: 10, price: 0 }],
    },
    staff: {
      type: [
        {
          name: { type: String, required: true },
          role: { type: String, default: "" },
          specialties: { type: String, default: "" },
          phone: { type: String, default: "" },
          profileImage: { type: String, default: "" },
          description: { type: String, default: "" },
          assignedServices: { type: [String], default: [] },
          isAvailable: { type: Boolean, default: true },
          workingHours: {
            open: { type: String, default: "09:00" },
            close: { type: String, default: "19:00" },
          },
          customersServed: { type: Number, default: 0 },
          rating: { type: Number, default: 5.0 },
        },
      ],
      default: [],
    },
    bookingSettings: {
      enableAppointments: { type: Boolean, default: true },
      allowStaffSelection: { type: Boolean, default: true },
      allowSameDayBooking: { type: Boolean, default: true },
      maxAdvanceBookingDays: { type: Number, default: 14 },
      cancellationWindowHours: { type: Number, default: 2 },
      bufferTimeBetweenAppointments: { type: Number, default: 15 },
    },
    queueSettings: {
      enableLiveQueue: { type: Boolean, default: true },
      allowWalkIns: { type: Boolean, default: true },
      queueOpeningTime: { type: String, default: "09:00" },
      queueClosingTime: { type: String, default: "20:00" },
      maxQueueCapacity: { type: Number, default: 30 },
    },
    paymentConfiguration: {
      paymentMode: {
        type: String,
        enum: ["PAY_AT_BUSINESS", "ONLINE", "BOTH"],
        default: "PAY_AT_BUSINESS",
      },
      onlinePaymentStatus: {
        type: String,
        enum: ["NOT_STARTED", "PENDING_VERIFICATION", "ACTIVE", "REJECTED", "SUSPENDED"],
        default: "NOT_STARTED",
      },
      paymentProvider: { type: String, default: "razorpay" },
      providerAccountReference: { type: String, default: "" }, // Razorpay Route Linked Account ID (acc_...)
      legalBusinessName: { type: String, default: "" },
      businessType: { type: String, default: "individual" },
      accountOnboardingUrl: { type: String, default: "" },
      accountRequirements: { type: [String], default: [] },
      upiId: { type: String, default: "" },
      lastVerificationUpdate: { type: Date, default: null },
    },
    onboarding: {
      currentStep: { type: Number, default: 1 },
      completedSteps: { type: [Number], default: [] },
      status: {
        type: String,
        enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"],
        default: "COMPLETED", // Backward-compatibility default for existing documents
      },
      startedAt: { type: Date, default: Date.now },
      completedAt: { type: Date, default: null },
    },
    basePrice: {
      type: Number,
      default: 0,
    },
    pricing: [
      {
        label: { type: String, required: true },
        price: { type: Number, required: true },
      },
    ],
    subscription: {
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
      expiresAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

const Business = mongoose.model("Business", businessSchema);
export default Business;
