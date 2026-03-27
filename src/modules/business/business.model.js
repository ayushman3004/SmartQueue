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
      enum: ["healthcare", "banking", "retail", "restaurant", "government", "other"],
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
    logo: {
      type: String,
      default: "",
    },
    serviceTypes: {
      type: [String],
      default: ["general"],
    },
  },
  { timestamps: true }
);

const Business = mongoose.model("Business", businessSchema);
export default Business;
