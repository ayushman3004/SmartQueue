import mongoose from "mongoose";
import Coupon from "./coupon.model.js";
import Business from "../business/business.model.js";
import ApiError from "../../../utils/ApiError.js";
import { canAccessOwnerCategory } from "../../utils/ownerCategory.js";
import { isClinic } from "../doctor/doctor-access.js";

/**
 * Validate and compute discount for a coupon code
 */
export const validateCoupon = async (code, userId, businessId) => {
  if (typeof code !== "string" || !code.trim()) throw new ApiError(400, "Coupon code is required");

  const coupon = await Coupon.findOne({
    code: code.trim().toUpperCase(),
    isActive: true,
    expiryAt: { $gte: new Date() },
  });

  if (!coupon) {
    throw new ApiError(404, "Invalid or expired coupon code");
  }

  // If tied to a specific user
  if (coupon.userId && coupon.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "This coupon is not valid for your account");
  }

  // If tied to a specific business
  if (coupon.businessId && String(coupon.businessId) !== String(businessId)) {
    throw new ApiError(400, "This coupon is not applicable to this business");
  }

  return {
    valid: true,
    discountAmount: coupon.amount,
    coupon,
  };
};

/**
 * Get available coupons for a user / business
 */
export const getAvailableCoupons = async (userId, businessId) => {
  if (businessId != null && !mongoose.isObjectIdOrHexString(businessId)) {
    throw new ApiError(400, "Invalid clinic ID");
  }
  const query = {
    isActive: true,
    expiryAt: { $gte: new Date() },
    $or: [
      { userId: null },
      { userId },
    ],
    businessId: businessId ? { $in: [null, businessId] } : null,
  };

  const coupons = await Coupon.find(query).sort({ amount: -1 });

  // If database has no coupons yet, provide default starter promotional coupons
  if (coupons.length === 0) {
    return [
      { code: "SERVEQ15", amount: 15, description: "Flat ₹15 off on any booking or queue entry" },
      { code: "WELCOME25", amount: 25, description: "Welcome bonus ₹25 off for first-time hubs" },
    ];
  }

  return coupons;
};

/**
 * Create a new coupon (admin or business owner)
 */
export const createCoupon = async ({ code, amount = 20, businessId, expiryDays = 7 }, actor) => {
  if (!["owner", "admin"].includes(actor?.role)) throw new ApiError(403, "Access denied");
  if (businessId != null && !mongoose.isObjectIdOrHexString(businessId)) {
    throw new ApiError(400, "Invalid clinic ID");
  }
  if (actor.role === "owner" && !businessId) throw new ApiError(403, "Select a clinic you own");
  if (businessId) {
    const filter = { _id: businessId };
    if (actor.role === "owner") Object.assign(filter, { owner: actor._id, approvalStatus: "approved" });
    const business = await Business.findOne(filter);
    if (!isClinic(business) || (actor.role === "owner" && !canAccessOwnerCategory(actor, business))) {
      throw new ApiError(404, "Clinic not found");
    }
  }
  if (typeof code !== "string" || !code.trim() || code.trim().length > 64) {
    throw new ApiError(400, "Enter a coupon code up to 64 characters");
  }
  const discount = typeof amount === "number" || typeof amount === "string" ? Number(amount) : NaN;
  if (!Number.isFinite(discount) || discount <= 0 || discount > Number.MAX_SAFE_INTEGER / 100) {
    throw new ApiError(400, "Enter a valid positive discount");
  }
  const days = typeof expiryDays === "number" || typeof expiryDays === "string" ? Number(expiryDays) : NaN;
  const expiryAt = new Date(Date.now() + days * 86_400_000);
  if (!Number.isSafeInteger(days) || days < 1 || !Number.isFinite(expiryAt.getTime())) {
    throw new ApiError(400, "Enter a valid number of expiry days");
  }
  const coupon = await Coupon.create({
    code: code.trim().toUpperCase(),
    amount: discount,
    businessId: businessId ?? null,
    userId: null,
    expiryAt,
    isActive: true,
  });
  return coupon;
};
