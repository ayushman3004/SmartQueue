import ApiError from "../../../utils/ApiError.js";

/**
 * Validate that an amount is a strictly positive, finite number.
 */
export const validateAmount = (amount) => {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) {
    throw new ApiError(400, "Amount must be a positive number greater than 0");
  }
  return Math.round(num * 100) / 100; // 2 decimal precision
};

export * from "./razorpay.service.js";
