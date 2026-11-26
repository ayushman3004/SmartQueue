import { changePasswordHandler } from "../business-application/business-application.routes.js";
import { Router } from "express";
import passport from "passport";
import {
  signup,
  signin,
  sendPhoneSignInOtp,
  verifyPhoneSignInOtp,
  googleCallback,
  getMe,
  logout,
  updateMe,
  upgradeToOwner,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  sendPhoneVerificationOtp,
  verifyPhoneVerificationOtp,
  setWhatsAppConsent,
  sendEmailVerificationOtp,
  verifyEmailVerificationOtp,
} from "./auth.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";
import {
  accountSecurityLimit, emailOtpSendLimit, phoneOtpSendLimit, profileOtpVerifyLimit,
  resetCompleteLimit, resetSendLimit, resetVerifyLimit, signInLimit, signupLimit, phoneSignInSendLimit, phoneSignInVerifyLimit,
} from "../../gateway/endpointRateLimits.js";

import { beginOAuth, validateOAuthState, oauthClientUrl, oauthResponseHeaders } from "./oauth-security.js";

const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Local auth
router.post("/signup", signupLimit, signup);
router.post("/signin", signInLimit, signin);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.post("/upgrade-to-owner", protect, accountSecurityLimit, upgradeToOwner);

router.post("/change-password", protect, accountSecurityLimit, changePasswordHandler);

// Profile Contact Verification
const requireWhatsApp = (req, res, next) => req.app.locals.whatsapp?.config.enabled
  ? next()
  : res.status(503).json({ message: "WhatsApp phone verification is temporarily unavailable." });
router.post('/phone/signin/send-otp', requireWhatsApp, phoneSignInSendLimit,
  (req, res, next) => req.app.locals.whatsapp.verifyTurnstile(req, res, next), sendPhoneSignInOtp);
router.post('/phone/signin/verify-otp', requireWhatsApp, phoneSignInVerifyLimit, verifyPhoneSignInOtp);
router.post("/phone/send-otp", protect, requireWhatsApp, phoneOtpSendLimit,
  (req, res, next) => req.app.locals.whatsapp.verifyTurnstile(req, res, next), sendPhoneVerificationOtp);
router.post("/phone/verify-otp", protect, requireWhatsApp, profileOtpVerifyLimit, verifyPhoneVerificationOtp);
router.patch("/phone/whatsapp-consent", protect, accountSecurityLimit,
  (req, res, next) => req.body?.enabled === true ? requireWhatsApp(req, res, next) : next(), setWhatsAppConsent);
router.post("/email/send-otp", protect, emailOtpSendLimit, sendEmailVerificationOtp);
router.post("/email/verify-otp", protect, profileOtpVerifyLimit, verifyEmailVerificationOtp);

// Forgot Password & Nodemailer OTP Verification
router.post(["/forgot-password", "/forgot-password/send-otp"], resetSendLimit, forgotPasswordSendOtp);
router.post(["/verify-otp", "/forgot-password/verify-otp"], resetVerifyLimit, forgotPasswordVerifyOtp);
router.post(["/reset-password", "/forgot-password/reset-password"], resetCompleteLimit, forgotPasswordReset);

// Google OAuth
router.get("/google", (req, res, next) => {
  oauthResponseHeaders(res);
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      error: "Google OAuth is not configured on this server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    });
  }
  const state = beginOAuth(req, res);
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state,
    session: false,
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  oauthResponseHeaders(res);
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(oauthClientUrl("/login?error=oauth_not_configured"));
  }

  if (!validateOAuthState(req, res)) return res.redirect(oauthClientUrl("/login?error=oauth_state_invalid"));
  const failureUrl = oauthClientUrl(req.oauthRole === "owner" ? "/hub/login" : "/login");

  passport.authenticate("google", { session: false }, (err, user) => {
    if (err) {
      const code = err.statusCode === 403 ? "customer_account_forbidden" : "oauth_error";
      return res.redirect(`${failureUrl}?error=${code}`);
    }

    if (!user) {
      return res.redirect(`${failureUrl}?error=auth_failed`);
    }

    req.user = user;
    return googleCallback(req, res, next);
  })(req, res, next);
});

export default router;
