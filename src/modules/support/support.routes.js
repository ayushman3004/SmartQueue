import { Router } from "express";
import { createSupportMessage } from "./support.service.js";
import { gatewayOptionalAuth } from "../../gateway/gateway.middleware.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

router.post("/", gatewayOptionalAuth, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Please provide your name." });
    }

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return res.status(400).json({ success: false, message: "Please select a subject." });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Please enter your query message." });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({ success: false, message: "Message cannot exceed 1000 characters." });
    }

    const clientIp = req.ip || req.headers["x-forwarded-for"] || "";

    const result = await createSupportMessage({
      name,
      email,
      subject,
      message,
      user: req.user,
      ip: clientIp,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("❌ Support ticket submission error:", err);
    return res.status(500).json({
      success: false,
      message: "An error occurred while submitting your message. Please try again or email support@serveq.tech directly.",
    });
  }
});

export default router;
