import User from "../auth/auth.model.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import {
  validateAmount,
  createPaymentOrder,
  verifyAndCreditWallet,
  deductWalletBalance,
} from "../payment/payment.service.js";
import { getPaymentProvider } from "../payment/payment.provider.js";

export const getBalance = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "User not found");
  res.json(
    new ApiResponse(200, {
      balance: user.walletBalance ?? 0,
      provider: getPaymentProvider().name,
    }, "Balance retrieved")
  );
});

export const createDepositOrder = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const order = await createPaymentOrder(req.user._id, {
    amount,
    description: "serveQ Wallet Deposit",
  });
  res.status(201).json(new ApiResponse(201, { order }, "Payment order created"));
});

export const verifyDeposit = asyncHandler(async (req, res) => {
  const { orderId, paymentId, amount } = req.body;
  const io = req.app.get("io");
  const result = await verifyAndCreditWallet(
    req.user._id,
    { orderId, paymentId, amount },
    io
  );
  res.json(new ApiResponse(200, result, "Deposit verified and wallet credited"));
});

export const addMoney = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const validated = validateAmount(amount);
  const io = req.app.get("io");

  const result = await verifyAndCreditWallet(
    req.user._id,
    { orderId: `direct_${Date.now()}`, paymentId: `direct_pay_${Date.now()}`, amount: validated },
    io
  );

  res.json(new ApiResponse(200, { balance: result.newBalance }, "Money added to wallet successfully"));
});

export const deductMoney = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;
  const io = req.app.get("io");
  const newBalance = await deductWalletBalance(req.user._id, amount, reason || "Manual deduction", io);

  res.json(new ApiResponse(200, { balance: newBalance }, "Money deducted successfully"));
});
