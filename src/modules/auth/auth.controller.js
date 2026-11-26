import { ipKey } from '../../gateway/rateLimiter.js';
import { isAdminAccessRequired } from "../../../middleware/admin-access.middleware.js";
import ApiError from "../../../utils/ApiError.js";
import { revokeSession, sessionTokenFrom } from "./session-security.js";
import * as authService from "./auth.service.js";
import * as forgotPasswordService from "./forgotPassword.service.js";
import * as verificationService from "./verification.service.js";
import User from "./auth.model.js";
import { oauthClientUrl, oauthResponseHeaders } from "./oauth-security.js";
import { updateWhatsAppConsent } from "./whatsapp-consent.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { generateToken, setTokenCookie, clearTokenCookie, responseToken } from "../auth.utils.js";

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const { user, token } = await authService.register({ name, email, password, role });
  setTokenCookie(res, token, req);
  res.status(201).json(new ApiResponse(201, { user, ...responseToken(req, token) }, "Registered successfully"));
});

export const signin = asyncHandler(async (req, res) => {
  const { email, password, requiredRole, activationCredential } = req.body;
  const { user, token } = await authService.login({ email, password, requiredRole, activationCredential });
  setTokenCookie(res, token, req);
  res.json(new ApiResponse(200, { user, ...responseToken(req, token) }, "Logged in successfully"));
});

export const sendPhoneSignInOtp = asyncHandler(async (req, res) => {
  const { challengeId, resendAfterSeconds } = await req.app.locals.whatsapp.phone.sendLogin({ phone: req.body?.phone, ip: ipKey(req) });
  res.json(new ApiResponse(200, { challengeId, resendAfterSeconds }, 'If your account uses this number, a code will arrive on WhatsApp.'));
});

export const verifyPhoneSignInOtp = asyncHandler(async (req, res) => {
  const user = await req.app.locals.whatsapp.phone.verifyLogin(req.body || {});
  const token = generateToken(user);
  setTokenCookie(res, token, req);
  res.json(new ApiResponse(200, { user: authService.sanitize(user), ...responseToken(req, token) }, 'Logged in successfully'));
});

export const checkAdminAccess = asyncHandler(async (req, res) => {
  if (req.adminAccess && !await User.exists({ email: req.adminAccess.email, role: "admin" })) {
    throw new ApiError(403, "Administrator access is required.");
  }
  if (req.query.return === "1") return res.redirect(oauthClientUrl("/admin/login"));
  res.sendStatus(204);
});

export const adminSignin = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const { user, token } = await authService.login({ email, password, requiredRole: "admin", adminAccess: req.adminAccess });
  setTokenCookie(res, token, req, req.adminAccess);
  res.json(new ApiResponse(200, { user }, "Logged in successfully"));
});

export const upgradeToOwner = asyncHandler(async (req, res) => {
  const user = await authService.upgradeToOwner(req.user._id);
  res.json(new ApiResponse(200, { user }, "Account successfully upgraded to Hub Owner"));
});

export const googleCallback = asyncHandler(async (req, res) => {
  if (req.user.role === "admin" && isAdminAccessRequired()) {
    return res.redirect(oauthClientUrl("/admin/login"));
  }
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
  const user = await authService.updateProfile(req.user._id, req.body, req.authTime);
  res.json(new ApiResponse(200, { user }, "Profile updated successfully"));
});

export const logout = asyncHandler(async (req, res) => {
  await revokeSession(sessionTokenFrom(req), req.app.get("io"));
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
const phoneVerificationInput = req => ({
  user: req.user, session: sessionTokenFrom(req), authTime: req.authTime,
  phone: req.body?.phone ?? req.body?.phoneNumber ?? req.user.phone,
});

export const sendPhoneVerificationOtp = asyncHandler(async (req, res) => {
  const result = await req.app.locals.whatsapp.phone.send({
    ...phoneVerificationInput(req), ip: ipKey(req),
  });
  res.json(new ApiResponse(200, result, "If WhatsApp can reach this number, a code will arrive shortly."));
});

export const verifyPhoneVerificationOtp = asyncHandler(async (req, res) => {
  const result = await req.app.locals.whatsapp.phone.verify({
    ...phoneVerificationInput(req), otp: req.body?.otp, challengeId: req.body?.challengeId, purpose: req.body?.purpose,
  });
  res.json(new ApiResponse(200, result, "Phone verified on WhatsApp."));
});

export const setWhatsAppConsent = asyncHandler(async (req, res) => {
  const result = await updateWhatsAppConsent(req.user, req.body?.enabled, req.body?.version);
  res.json(new ApiResponse(200, result));
});

export const sendEmailVerificationOtp = asyncHandler(async (req, res) => {
  const email = (req.user.ownerAccess?.applicationId || (req.user.role === "admin" && isAdminAccessRequired())) ? req.user.email : (req.body.email || req.user.email);
  const result = await verificationService.sendEmailVerificationOtp({
    email,
    userId: req.user._id,
    userName: req.user.name,
    ownerTokenVersion: req.user.ownerAccess?.status === "INVITED" ? req.user.tokenVersion : undefined,
  });
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export const verifyEmailVerificationOtp = asyncHandler(async (req, res) => {
  const email = (req.user.ownerAccess?.applicationId || (req.user.role === "admin" && isAdminAccessRequired())) ? req.user.email : (req.body.email || req.user.email);
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
    Object.assign(result, responseToken(req, token));
  }
  res.status(200).json(new ApiResponse(200, result, result.message));
});

