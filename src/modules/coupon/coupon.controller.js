import * as couponService from "./coupon.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

export const validate = asyncHandler(async (req, res) => {
  const { code, businessId } = req.body;
  const result = await couponService.validateCoupon(code, req.user._id, businessId);
  res.json(new ApiResponse(200, result, `Coupon applied: -₹${result.discountAmount}`));
});

export const getAvailable = asyncHandler(async (req, res) => {
  const { businessId } = req.query;
  const coupons = await couponService.getAvailableCoupons(req.user._id, businessId);
  res.json(new ApiResponse(200, { coupons }));
});

export const create = asyncHandler(async (req, res) => {
  const { code, amount, businessId, expiryDays } = req.body;
  const coupon = await couponService.createCoupon({
    code,
    amount,
    businessId,
    userId: null,
    expiryDays,
  });
  res.status(201).json(new ApiResponse(201, { coupon }, "Coupon created"));
});
