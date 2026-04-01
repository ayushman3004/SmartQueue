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
      enum: ["healthcare", "banking", "retail", "salon", "restaurant", "government", "other"],
      default: "other",
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
        }
      ],
      default: [{ name: "general", duration: 10 }]
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
  },
  { timestamps: true }
);

const Business = mongoose.model("Business", businessSchema);
export default Business;
