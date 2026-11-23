import crypto from "node:crypto";
import { activateOwner } from "../business-application/business-application.service.js";
import { sanitize } from "./auth.service.js";
import NodemailerHelper from "nodemailer-otp";
import Otp from "./otp.model.js";
import User from "./auth.model.js";
import ApiError from "../../../utils/ApiError.js";
import { getMailTransporter } from "../email/email.service.js";

/**
 * Email delivery helper
 * Uses Nodemailer and Resend API to deliver OTPs directly to inbox.
 */
export const sendEmailWithReceipt = async ({ to, subject, html, text }) => {
  const from = process.env.EMAIL_SECURITY_FROM || '"ServeQ Security" <security@serveq.tech>';
  const replyTo = process.env.EMAIL_SUPPORT || "support@serveq.tech";

  // 1. Try direct Resend REST API
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: replyTo,
          subject,
          text,
          html,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log(`✅ [Resend API] Accepted for ${to} (ID: ${data.id})`);
        return { accepted: true, resendId: data.id };
      }
      console.warn("[email] Provider rejected delivery", response.status);
    } catch (fetchErr) {
      console.warn("[email] Provider unavailable", fetchErr.name);
    }
  }

  // 2. Try Nodemailer transporter
  const transporter = getMailTransporter();
  if (transporter) {
    try {
      const receipt = await transporter.sendMail({
        from,
        to,
        replyTo,
        subject,
        text,
        html,
      });
      return { accepted: Boolean(receipt.accepted?.length) };
    } catch (nmErr) {
      console.warn("[email] SMTP delivery failed", nmErr.code);
    }
  }

  return { accepted: false };
};

export const sendEmailMessage = async (message) => (await sendEmailWithReceipt(message)).accepted;

/**
 * ─── EMAIL VERIFICATION OTP (using nodemailer-otp & nodemailer) ────
 */
export const sendEmailVerificationOtp = async ({ email, userId, userName, ownerTokenVersion }) => {
  if (!email || typeof email !== "string") {
    throw new ApiError(400, "Valid email address is required");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new ApiError(400, "Please provide a valid email format");
  }

  // Check if another user already owns this email
  if (userId) {
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing && existing._id.toString() !== userId.toString()) {
      throw new ApiError(400, "This email is already registered to another account");
    }
  }

  // Cooldown check (30 seconds)
  const existingOtp = await Otp.findOne({
    email: normalizedEmail,
    purpose: "email_verification",
  });
  if (existingOtp && Date.now() - new Date(existingOtp.lastResentAt || existingOtp.updatedAt).getTime() < 30000) {
    const waitSec = Math.ceil(
      (30000 - (Date.now() - new Date(existingOtp.lastResentAt || existingOtp.updatedAt).getTime())) / 1000
    );
    throw new ApiError(429, `Please wait ${waitSec}s before requesting a new email verification code.`);
  }

  // 1. Generate 6-digit OTP using nodemailer-otp helper
  let otp;
  const gmailUser = (process.env.GMAIL_USER || "").trim();
  const gmailPass = (process.env.GMAIL_PASS || "").trim();

  let nodemailerOtpHelperInstance = null;
  try {
    if (gmailUser && gmailPass) {
      nodemailerOtpHelperInstance = new NodemailerHelper(gmailUser, gmailPass);
      otp = nodemailerOtpHelperInstance.generateOtp(6);
    }
  } catch (helperInitErr) {
    console.warn("⚠️ [nodemailer-otp] Init fallback:", helperInitErr.message);
  }

  // Fallback generation if helper was not instantiated
  if (!otp || otp.length !== 6) {
    otp = crypto.randomInt(100000, 1000000).toString();
  }

  // Expiry in 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Upsert OTP record
  await Otp.findOneAndUpdate(
    { email: normalizedEmail, purpose: "email_verification" },
    {
      otp,
      ownerTokenVersion,
      expiresAt,
      attempts: 0,
      verified: false,
      lastResentAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // 2. Dispatch email using nodemailer-otp or robust Nodemailer transporter
  let emailSent = false;

  // Try nodemailer-otp sendEmail if Gmail credentials configured
  if (nodemailerOtpHelperInstance) {
    try {
      const helperResult = await nodemailerOtpHelperInstance.sendEmail(
        normalizedEmail,
        `${otp} is your serveQ Email Verification Code`,
        "Your serveQ one-time verification passcode is",
        otp
      );
      if (helperResult?.success) {
        emailSent = true;
        console.log(`✅ [nodemailer-otp] Delivered to ${normalizedEmail}`);
      }
    } catch (sendErr) {
      console.warn("⚠️ [nodemailer-otp] Direct send error:", sendErr.message);
    }
  }

  // If not sent via nodemailer-otp directly, send via our Nodemailer transporter
  if (!emailSent) {
    const recipientName = userName ? userName.split(" ")[0] : "there";
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 32px 16px;">
          <div style="margin-bottom: 20px;">
            <a href="https://serveq.tech" style="text-decoration: none; display: inline-block;">
              <img src="https://www.serveq.tech/serveq-logo.png" alt="serveQ" height="26" style="height: 26px; width: auto; max-width: 130px; display: block; border: 0; outline: none;" />
            </a>
          </div>
          <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
            Email Verification Code
          </div>
          <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">
            Hi ${recipientName}, use this one-time passcode to verify your email terminal on serveQ:
          </p>
          <div style="background-color: #fff6f4; border: 2px dashed #fecbc2; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #FF5537;">${otp}</span>
            <div style="font-size: 11px; color: #64748b; margin-top: 6px;">⏱ Valid for 10 minutes</div>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            If you did not request this verification, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;

    emailSent = await sendEmailMessage({
      to: normalizedEmail,
      subject: `${otp} is your serveQ Email Verification Code`,
      html,
      text: `Hi ${recipientName}, your serveQ email verification OTP is ${otp}. Valid for 10 minutes.`,
    });
  }

  if (!emailSent) throw new ApiError(503, "Email could not be delivered. Please retry shortly.");
  return {
    success: true,
    message: "Verification code sent to your email address.",
    email: normalizedEmail,
  };
};

/**
 * ─── VERIFY EMAIL OTP ──────────────────────────────────────────
 */
export const verifyEmailVerificationOtp = async ({ email, otp, userId, ownerTokenVersion }) => {
  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP code are required");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const cleanOtp = String(otp).trim();

  const record = await Otp.findOne({
    email: normalizedEmail,
    purpose: "email_verification",
  });

  if (!record) {
    throw new ApiError(400, "Verification code not found or expired. Please request a new code.");
  }

  if (new Date() > new Date(record.expiresAt)) {
    await Otp.deleteOne({ _id: record._id });
    throw new ApiError(400, "Verification code has expired. Please request a new code.");
  }

  if (record.attempts >= 3) {
    await Otp.deleteOne({ _id: record._id });
    throw new ApiError(429, "Too many failed attempts. Please request a new verification code.");
  }

  if (record.otp !== cleanOtp) {
    record.attempts += 1;
    await record.save();
    throw new ApiError(400, `Invalid verification code. ${3 - record.attempts} attempt(s) remaining.`);
  }

  // Update user profile
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User account not found");
  }

  let activatedUser;
  if (user.ownerAccess?.applicationId && user.ownerAccess.status === "INVITED") {
    if (record.ownerTokenVersion !== ownerTokenVersion || ownerTokenVersion !== user.tokenVersion) throw new ApiError(403, "Invitation changed. Sign in and request a new OTP.");
    if (normalizedEmail !== user.email) throw new ApiError(403, "Verify your approved business email.");
    activatedUser = await activateOwner(user);
  } else {
    user.email = normalizedEmail;
    user.isEmailVerified = true;
    await user.save();
  }

  // Clear OTP record
  await Otp.deleteOne({ _id: record._id });

  return {
    success: true,
    message: "Email address verified successfully!",
    ...(activatedUser ? { activatedUser } : {}),
    user: sanitize(activatedUser || user),
  };
};

// Email delivery cannot prove control of a phone. Legacy routes fail closed.
export const sendPhoneVerificationOtp = async () => {
  throw new ApiError(410, "Use SMS phone verification. Email codes cannot verify phone ownership.");
};
export const verifyPhoneVerificationOtp = async () => {
  throw new ApiError(410, "Use SMS phone verification. Email codes cannot verify phone ownership.");
};
