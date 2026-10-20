import { Router } from "express";
import PrelaunchCustomer from "./waitlist.model.js";
import { sendLaunchConfirmationEmail } from "../email/email.service.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

router.post("/", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const clientIp = req.ip || req.headers["x-forwarded-for"] || "";

    // 1. Check or save in database as prelaunch customer
    let customer = null;
    let isExisting = false;

    try {
      customer = await PrelaunchCustomer.findOne({ email: cleanEmail });
      if (customer) {
        isExisting = true;
      } else {
        customer = await PrelaunchCustomer.create({
          email: cleanEmail,
          role: "prelaunch_customer",
          tag: "prelaunch_customer",
          status: "confirmed",
          source: "coming_soon_landing",
          ip: clientIp,
        });
      }
    } catch (dbErr) {
      console.warn("⚠️ Prelaunch customer DB write warning:", dbErr.message);
    }

    // 2. Send launch confirmation email
    let emailResult = { sent: false };
    try {
      emailResult = await sendLaunchConfirmationEmail({ to: cleanEmail });
      if (emailResult?.sent && customer) {
        customer.confirmationEmailSent = true;
        customer.confirmationMessageId = emailResult.messageId || "";
        await customer.save().catch(() => {});
      }
    } catch (mailErr) {
      console.error("⚠️ Launch confirmation email sending error:", mailErr.message);
    }

    if (isExisting) {
      return res.status(200).json({
        status: "ok",
        message: "You're already confirmed on the launch list! A confirmation email has been sent.",
      });
    }

    return res.status(200).json({
      status: "ok",
      message: "You're on the list! We've sent a launch confirmation email to your inbox.",
    });
  } catch (err) {
    console.error("❌ Waitlist controller error:", err);
    return res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

export default router;
