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
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", session: false }),
  googleCallback
);

export default router;
