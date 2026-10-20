import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Please enter a valid email"],
    },
    source: {
      type: String,
      default: "coming_soon",
    },
    ip: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Waitlist = mongoose.model("Waitlist", waitlistSchema);
export default Waitlist;
