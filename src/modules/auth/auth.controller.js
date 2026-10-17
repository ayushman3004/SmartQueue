import * as authService from "./auth.service.js";
import * as forgotPasswordService from "./forgotPassword.service.js";
import * as verificationService from "./verification.service.js";
import User from "./auth.model.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { generateToken, setTokenCookie } from "../auth.utils.js";

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const { user, token } = await authService.register({ name, email, password, role });
  setTokenCookie(res, token);
  res.status(201).json(new ApiResponse(201, { user, token }, "Registered successfully"));
});

export const signin = asyncHandler(async (req, res) => {
  const { email, password, requiredRole } = req.body;
  const { user, token } = await authService.login({ email, password, requiredRole });
  setTokenCookie(res, token);
  res.json(new ApiResponse(200, { user, token }, "Logged in successfully"));
});

export const upgradeToOwner = asyncHandler(async (req, res) => {
  const user = await authService.upgradeToOwner(req.user._id);
  res.json(new ApiResponse(200, { user }, "Account successfully upgraded to Hub Owner"));
});

export const googleCallback = asyncHandler(async (req, res) => {
  // User attached by Passport
  const token = generateToken(req.user);
  setTokenCookie(res, token);
  // Redirect to frontend with token in query (client stores it)
  res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user._id);
  res.json(new ApiResponse(200, { user }));
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user._id, req.body);
  res.json(new ApiResponse(200, { user }, "Profile updated successfully"));
});

export const logout = asyncHandler(async (_req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
  res.json(new ApiResponse(200, {}, "Logged out successfully"));
});

export const forgotPasswordSendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await forgotPasswordService.sendPasswordResetOtp(email);
  res.status(200).json(new ApiResponse(200, result, "Verification code sent to your email"));
});

export const forgotPasswordVerifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const result = await forgotPasswordService.verifyPasswordResetOtp(email, otp);
  res.status(200).json(new ApiResponse(200, result, "Verification code verified successfully"));
});

export const forgotPasswordReset = asyncHandler(async (req, res) => {
  const { email, resetToken, otp, newPassword } = req.body;
  const result = await forgotPasswordService.resetPassword({
    rawEmail: email,
    resetToken,
    otp,
    newPassword,
  });
  res.status(200).json(new ApiResponse(200, result, "Password reset successfully. You can now log in."));
});

// ─── Profile Contact Verification Controllers ─────────────────
export const sendPhoneVerificationOtp = asyncHandler(async (req, res) => {
  const phone = req.body.phone || req.body.phoneNumber || req.user.phone;
  const result = await verificationService.sendPhoneVerificationOtp({
    phone,
    userId: req.user._id,
  });
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export const verifyPhoneVerificationOtp = asyncHandler(async (req, res) => {
  const phone = req.body.phone || req.body.phoneNumber || req.user.phone;
  const { otp } = req.body;
  const result = await verificationService.verifyPhoneVerificationOtp({
    phone,
    otp,
    userId: req.user._id,
  });
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export const sendEmailVerificationOtp = asyncHandler(async (req, res) => {
  const email = req.body.email || req.user.email;
  const result = await verificationService.sendEmailVerificationOtp({
    email,
    userId: req.user._id,
    userName: req.user.name,
  });
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export const verifyEmailVerificationOtp = asyncHandler(async (req, res) => {
  const email = req.body.email || req.user.email;
  const { otp } = req.body;
  const result = await verificationService.verifyEmailVerificationOtp({
    email,
    otp,
    userId: req.user._id,
  });
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export const verifyFirebasePhone = asyncHandler(async (req, res) => {
  const phone = req.body.phone || req.user.phone;
  if (!phone) {
    return res.status(400).json(new ApiResponse(400, null, "Phone number is required"));
  }
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, "User account not found"));
  }
  user.phone = phone.trim();
  user.isPhoneVerified = true;
  await user.save();

  res.status(200).json(
    new ApiResponse(200, { user: authService.sanitize(user) }, "Phone number verified successfully via Firebase!")
  );
});


