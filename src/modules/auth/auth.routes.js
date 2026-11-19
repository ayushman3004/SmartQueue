import { changePasswordHandler } from "../business-application/business-application.routes.js";
import { Router } from "express";
import passport from "passport";
import {
  signup,
  signin,
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
  verifyFirebasePhone,
  sendEmailVerificationOtp,
  verifyEmailVerificationOtp,
} from "./auth.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";

import { beginOAuth, validateOAuthState, oauthClientUrl, oauthResponseHeaders } from "./oauth-security.js";

const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Local auth
router.post("/signup", signup);
router.post("/signin", signin);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.post("/upgrade-to-owner", protect, upgradeToOwner);

router.post("/change-password", protect, changePasswordHandler);

// Profile Contact Verification
router.post("/phone/send-otp", protect, sendPhoneVerificationOtp);
router.post("/phone/verify-otp", protect, verifyPhoneVerificationOtp);
router.post("/phone/verify-firebase", protect, verifyFirebasePhone);
router.post("/email/send-otp", protect, sendEmailVerificationOtp);
router.post("/email/verify-otp", protect, verifyEmailVerificationOtp);

// Forgot Password & Nodemailer OTP Verification
router.post("/forgot-password", forgotPasswordSendOtp);
router.post("/forgot-password/send-otp", forgotPasswordSendOtp);
router.post("/verify-otp", forgotPasswordVerifyOtp);
router.post("/forgot-password/verify-otp", forgotPasswordVerifyOtp);
router.post("/reset-password", forgotPasswordReset);
router.post("/forgot-password/reset-password", forgotPasswordReset);

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
