import * as authService from "./auth.service.js";
import * as forgotPasswordService from "./forgotPassword.service.js";
import * as verificationService from "./verification.service.js";
import User from "./auth.model.js";
import { oauthClientUrl, oauthResponseHeaders } from "./oauth-security.js";
import { verifyFirebasePhone as verifyPhoneProof } from "./phone-verification.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { generateToken, setTokenCookie, clearTokenCookie } from "../auth.utils.js";

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const { user, token } = await authService.register({ name, email, password, role });
  setTokenCookie(res, token, req);
  res.status(201).json(new ApiResponse(201, { user, token }, "Registered successfully"));
});

export const signin = asyncHandler(async (req, res) => {
  const { email, password, requiredRole, activationCredential } = req.body;
  const { user, token } = await authService.login({ email, password, requiredRole, activationCredential });
  setTokenCookie(res, token, req);
  res.json(new ApiResponse(200, { user, token }, "Logged in successfully"));
});

export const upgradeToOwner = asyncHandler(async (req, res) => {
  const user = await authService.upgradeToOwner(req.user._id);
  res.json(new ApiResponse(200, { user }, "Account successfully upgraded to Hub Owner"));
});

export const googleCallback = asyncHandler(async (req, res) => {
  // User attached by Passport
  const token = generateToken(req.user);
  setTokenCookie(res, token, req);
  oauthResponseHeaders(res);
  res.redirect(oauthClientUrl("/auth/callback"));
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user._id);
  res.json(new ApiResponse(200, { user }));
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user._id, req.body);
  res.json(new ApiResponse(200, { user }, "Profile updated successfully"));
});

export const logout = asyncHandler(async (req, res) => {
  clearTokenCookie(res, req);
  res.set("Cache-Control", "no-store");
  res.json(new ApiResponse(200, {}, "Logged out successfully"));
});

export const forgotPasswordSendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  try { await forgotPasswordService.sendPasswordResetOtp(email); }
  catch (error) { if (error.statusCode === 400) throw error; }
  // Identical public response for unknown accounts, cooldown and delivery failures.
  res.status(200).json(new ApiResponse(200, { sent: true }, "If an eligible account exists, a verification code will be sent. Check your email or try again shortly."));
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
  const resetUser = await User.findOne({email: result.email});
  if (resetUser) req.app.get("io")?.in(`user:${resetUser._id}`).disconnectSockets(true);
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
  const email = req.user.ownerAccess?.applicationId ? req.user.email : (req.body.email || req.user.email);
  const result = await verificationService.sendEmailVerificationOtp({
    email,
    userId: req.user._id,
    userName: req.user.name,
    ownerTokenVersion: req.user.ownerAccess?.status === "INVITED" ? req.user.tokenVersion : undefined,
  });
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export const verifyEmailVerificationOtp = asyncHandler(async (req, res) => {
  const email = req.user.ownerAccess?.applicationId ? req.user.email : (req.body.email || req.user.email);
  const { otp } = req.body;
  const result = await verificationService.verifyEmailVerificationOtp({
    email,
    otp,
    userId: req.user._id,
    ownerTokenVersion: req.user.ownerAccess?.status === "INVITED" ? req.user.tokenVersion : undefined,
  });
  if (result.activatedUser) {
    const token = generateToken(result.activatedUser);
    setTokenCookie(res, token, req);
    delete result.activatedUser;
    result.token = token;
  }
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export const verifyFirebasePhone = asyncHandler(async (req, res) => {
  const result = await verifyPhoneProof({ userId: req.user._id, phone: req.body.phone, idToken: req.body.idToken });
  res.status(200).json(new ApiResponse(200, result, "Phone number verified successfully."));
});


