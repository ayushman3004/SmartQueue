import User from "../auth/auth.model.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

export const getBalance = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json(new ApiResponse(200, { balance: user.walletBalance }, "Balance retrieved"));
});

export const addMoney = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const user = await User.findByIdAndUpdate(req.user._id, { $inc: { walletBalance: amount } }, { new: true });

  // Emit real-time wallet update via Socket.IO
  const io = req.app.get("io");
  if (io) {
    io.to(`user:${req.user._id}`).emit("wallet:update", { balance: user.walletBalance });
  }

  res.json(new ApiResponse(200, { balance: user.walletBalance }, "Money added to wallet successfully"));
});

export const deductMoney = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const user = await User.findById(req.user._id);
  if (user.walletBalance < amount) {
    return res.status(400).json(new ApiResponse(400, null, "Insufficient wallet balance"));
  }
  user.walletBalance -= amount;
  await user.save();

  // Emit real-time wallet update via Socket.IO
  const io = req.app.get("io");
  if (io) {
    io.to(`user:${req.user._id}`).emit("wallet:update", { balance: user.walletBalance });
  }

  res.json(new ApiResponse(200, { balance: user.walletBalance }, "Money deducted successfully"));
});
