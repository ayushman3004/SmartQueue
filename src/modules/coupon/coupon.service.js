import Coupon from "./coupon.model.js";
import ApiError from "../../../utils/ApiError.js";

/**
 * Validate and compute discount for a coupon code
 */
export const validateCoupon = async (code, userId, businessId) => {
  if (!code) throw new ApiError(400, "Coupon code is required");

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
  if (coupon.businessId && businessId && coupon.businessId.toString() !== businessId.toString()) {
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
  const query = {
    isActive: true,
    expiryAt: { $gte: new Date() },
    $or: [
      { userId: null },
      { userId },
    ],
  };

  if (businessId) {
    query.$and = [
      {
        $or: [
          { businessId: null },
          { businessId },
        ],
      },
    ];
  }

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
export const createCoupon = async ({ code, amount, businessId, userId, expiryDays = 7 }) => {
  const expiryAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
  const coupon = await Coupon.create({
    code: code.trim().toUpperCase(),
    amount: Number(amount) || 20,
    businessId: businessId || null,
    userId: userId || null,
    expiryAt,
    isActive: true,
  });
  return coupon;
};
