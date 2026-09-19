import User from "../auth/auth.model.js";
import ApiError from "../../../utils/ApiError.js";
import { getPaymentProvider } from "./payment.provider.js";

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

/**
 * Create a new payment order via the payment provider.
 */
export const createPaymentOrder = async (userId, { amount, description, metadata = {} }) => {
  const validatedAmount = validateAmount(amount);
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const provider = getPaymentProvider();
  const order = await provider.createPaymentOrder({
    amount: validatedAmount,
    currency: "INR",
    customerId: user._id.toString(),
    customerEmail: user.email,
    description,
    metadata,
  });

  return order;
};

/**
 * Verify payment from provider and safely credit user wallet atomically.
 */
export const verifyAndCreditWallet = async (userId, { orderId, paymentId, amount }, io = null) => {
  const validatedAmount = validateAmount(amount);
  const provider = getPaymentProvider();

  const verification = await provider.verifyPayment({
    orderId,
    paymentId,
    amount: validatedAmount,
  });

  if (!verification.verified) {
    throw new ApiError(400, "Payment verification failed");
  }

  // Atomic credit
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: validatedAmount } },
    { new: true }
  ).select("-password");

  if (!updatedUser) throw new ApiError(404, "User not found");

  if (io) {
    io.to(`user:${userId}`).emit("wallet:update", { balance: updatedUser.walletBalance });
    io.to(`user:${userId}`).emit("wallet:updated", {
      balance: updatedUser.walletBalance,
      delta: validatedAmount,
      type: "credit",
      reason: "Payment deposit",
    });
  }

  return {
    success: true,
    newBalance: updatedUser.walletBalance,
    amountCredited: validatedAmount,
    payment: verification,
  };
};

/**
 * Atomically deduct funds from user wallet with strict overdraft protection.
 */
export const deductWalletBalance = async (userId, amount, reason = "Booking payment", io = null) => {
  const validatedAmount = validateAmount(amount);

  // Safe atomic conditional update: only decrement if walletBalance >= validatedAmount
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: validatedAmount } },
    { $inc: { walletBalance: -validatedAmount } },
    { new: true }
  ).select("-password");

  if (!updatedUser) {
    const user = await User.findById(userId);
    const current = user ? user.walletBalance : 0;
    throw new ApiError(400, `Insufficient wallet balance. Available: ₹${current}, Required: ₹${validatedAmount}`);
  }

  if (io) {
    io.to(`user:${userId}`).emit("wallet:update", { balance: updatedUser.walletBalance });
    io.to(`user:${userId}`).emit("wallet:updated", {
      balance: updatedUser.walletBalance,
      delta: -validatedAmount,
      type: "debit",
      reason,
    });
  }

  return updatedUser.walletBalance;
};

/**
 * Atomically refund / credit funds to user wallet.
 */
export const refundToWallet = async (userId, amount, reason = "Booking refund", io = null) => {
  const validatedAmount = validateAmount(amount);

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: validatedAmount } },
    { new: true }
  ).select("-password");

  if (!updatedUser) throw new ApiError(404, "User not found");

  if (io) {
    io.to(`user:${userId}`).emit("wallet:update", { balance: updatedUser.walletBalance });
    io.to(`user:${userId}`).emit("wallet:updated", {
      balance: updatedUser.walletBalance,
      delta: validatedAmount,
      type: "credit",
      reason,
    });
  }

  return updatedUser.walletBalance;
};
