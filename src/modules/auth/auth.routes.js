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
} from "./auth.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";

const router = Router();

// Local auth
router.post("/signup", signup);
router.post("/signin", signin);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.post("/upgrade-to-owner", protect, upgradeToOwner);

// Forgot Password & Nodemailer OTP Verification
router.post("/forgot-password", forgotPasswordSendOtp);
router.post("/forgot-password/send-otp", forgotPasswordSendOtp);
router.post("/verify-otp", forgotPasswordVerifyOtp);
router.post("/forgot-password/verify-otp", forgotPasswordVerifyOtp);
router.post("/reset-password", forgotPasswordReset);
router.post("/forgot-password/reset-password", forgotPasswordReset);

// Google OAuth
router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      error: "Google OAuth is not configured on this server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    });
  }
  const role = req.query.role === "owner" ? "owner" : "customer";
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: role,
    session: false,
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${clientUrl}/login?error=oauth_not_configured`);
  }

  passport.authenticate("google", { session: false }, (err, user) => {
    const role = req.query?.state === "owner" ? "owner" : "customer";
    const failureUrl = role === "owner" ? `${clientUrl}/business` : `${clientUrl}/login`;

    if (err) {
      const code = err.statusCode === 403 ? "customer_account_forbidden" : "oauth_error";
      const message = encodeURIComponent(err.message || "Authentication failed");
      return res.redirect(`${failureUrl}?error=${code}&message=${message}`);
    }

    if (!user) {
      return res.redirect(`${failureUrl}?error=auth_failed`);
    }

    req.user = user;
    return googleCallback(req, res, next);
  })(req, res, next);
});

export default router;
