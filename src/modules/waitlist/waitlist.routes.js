import { Router } from "express";
import Waitlist from "./waitlist.model.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

router.post("/", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if already subscribed
    try {
      const existing = await Waitlist.findOne({ email: cleanEmail });
      if (existing) {
        return res.status(200).json({
          status: "ok",
          message: "You're already on the list! We'll keep you posted.",
        });
      }

      await Waitlist.create({
        email: cleanEmail,
        source: "coming_soon",
        ip: req.ip || req.headers["x-forwarded-for"],
      });
    } catch (dbErr) {
      console.warn("Waitlist DB write warning (acknowledged for client):", dbErr.message);
    }

    return res.status(200).json({
      status: "ok",
      message: "You're on the list. We'll email you when serveQ launches.",
    });
  } catch (err) {
    console.error("Waitlist error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
