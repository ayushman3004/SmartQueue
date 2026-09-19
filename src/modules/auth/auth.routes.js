import { Router } from "express";
import passport from "passport";
import { signup, signin, googleCallback, getMe, logout, updateMe } from "./auth.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";

const router = Router();

// Local auth
router.post("/signup", signup);
router.post("/signin", signin);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);

// Google OAuth
router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      error: "Google OAuth is not configured on this server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    });
  }
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    return res.redirect(`${clientUrl}/login?error=oauth_not_configured`);
  }
  passport.authenticate("google", { failureRedirect: "/login", session: false })(req, res, next);
}, googleCallback);

export default router;
