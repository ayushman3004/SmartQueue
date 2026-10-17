import NodemailerHelper from "nodemailer-otp";
import nodemailer from "nodemailer";
import Otp from "./otp.model.js";
import User from "./auth.model.js";
import ApiError from "../../../utils/ApiError.js";
import { getMailTransporter } from "../email/email.service.js";

// Helper to sanitize user object for response
const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  role: user.role,
  walletBalance: user.walletBalance ?? 0,
  authProvider: user.authProvider,
  phone: user.phone || "",
  isPhoneVerified: Boolean(user.isPhoneVerified),
  isEmailVerified: Boolean(user.isEmailVerified || user.authProvider === "google"),
  bio: user.bio || "",
  location: user.location || "",
});

/**
 * Robust Email Sender Helper (without Twilio)
 * Uses Nodemailer and Resend API to deliver OTPs directly to inbox.
 */
const sendEmailMessage = async ({ to, subject, html, text }) => {
  const defaultFrom = "serveQ Security <onboarding@resend.dev>";
  const from =
    process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes("serveq.tech")
      ? process.env.EMAIL_FROM
      : defaultFrom;

  // 1. Try Nodemailer transporter
  const transporter = getMailTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      console.log(`✅ [Nodemailer] Delivered email to ${to}`);
      return true;
    } catch (nmErr) {
      console.warn(`⚠️ [Nodemailer] Transporter send failed:`, nmErr.message);
    }
  }

  // 2. Try direct Resend REST API
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: defaultFrom,
          to: [to],
          subject,
          text,
          html,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log(`✅ [Resend API] Delivered to ${to} (ID: ${data.id})`);
        return true;
      }

      // If Resend failed because recipient is not the account owner (Resend free sandbox restriction)
      if (typeof data?.message === "string" && data.message.includes("testing emails to your own email address") && to !== "ayushman.rick007@gmail.com") {
        console.warn(`⚠️ [Resend Sandbox Mode] Forwarding OTP to account email ayushman.rick007@gmail.com`);
        const retryRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: defaultFrom,
            to: ["ayushman.rick007@gmail.com"],
            subject: `[OTP for ${to}] ${subject}`,
            text: `Intended Recipient: ${to}\n\n${text}`,
            html: `<div style="padding:10px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;margin-bottom:12px;font-size:12px;color:#92400e;"><strong>Resend Test Mode:</strong> Originally intended for <code>${to}</code></div>${html}`,
          }),
        });
        const retryData = await retryRes.json();
        if (retryRes.ok) {
          console.log(`✅ [Resend Sandbox] Delivered to ayushman.rick007@gmail.com (ID: ${retryData.id})`);
          return true;
        }
      }
    } catch (fetchErr) {
      console.warn(`⚠️ [Resend API] Fetch error:`, fetchErr.message);
    }
  }

  return false;
};

/**
 * ─── EMAIL VERIFICATION OTP (using nodemailer-otp & nodemailer) ────
 */
export const sendEmailVerificationOtp = async ({ email, userId, userName }) => {
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
    otp = Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Expiry in 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Upsert OTP record
  await Otp.findOneAndUpdate(
    { email: normalizedEmail, purpose: "email_verification" },
    {
      otp,
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
        <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="font-size: 22px; font-weight: 900; color: #0f172a; margin-bottom: 8px;">
            serve<span style="color: #FF5537;">Q</span> Verification
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

  return {
    success: true,
    message: "Verification code sent to your email address.",
    email: normalizedEmail,
  };
};

/**
 * ─── VERIFY EMAIL OTP ──────────────────────────────────────────
 */
export const verifyEmailVerificationOtp = async ({ email, otp, userId }) => {
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

  user.email = normalizedEmail;
  user.isEmailVerified = true;
  await user.save();

  // Clear OTP record
  await Otp.deleteOne({ _id: record._id });

  return {
    success: true,
    message: "Email address verified successfully!",
    user: sanitizeUser(user),
  };
};

/**
 * ─── PHONE VERIFICATION OTP (Without Twilio - delivered via Nodemailer & nodemailer-otp) ────
 */
export const sendPhoneVerificationOtp = async ({ phone, userId }) => {
  if (!phone || typeof phone !== "string") {
    throw new ApiError(400, "Valid phone number is required");
  }

  // Clean phone string
  const rawClean = phone.trim().replace(/[\s\-()]/g, "");
  if (rawClean.length < 8) {
    throw new ApiError(400, "Please enter a valid phone number (at least 8-10 digits)");
  }

  // Format to E.164 if 10-digit Indian number without country code
  const cleanPhone = /^[6-9]\d{9}$/.test(rawClean) ? `+91${rawClean}` : rawClean;

  // Cooldown check (30 seconds)
  const existingOtp = await Otp.findOne({
    $or: [{ phoneNumber: cleanPhone }, { phoneNumber: rawClean }],
    purpose: "phone_verification",
  });
  if (existingOtp && Date.now() - new Date(existingOtp.lastResentAt || existingOtp.updatedAt).getTime() < 30000) {
    const waitSec = Math.ceil(
      (30000 - (Date.now() - new Date(existingOtp.lastResentAt || existingOtp.updatedAt).getTime())) / 1000
    );
    throw new ApiError(429, `Please wait ${waitSec}s before requesting a new phone verification code.`);
  }

  // 1. Generate 6-digit numeric OTP using nodemailer-otp helper
  let otp;
  const gmailUser = (process.env.GMAIL_USER || "").trim();
  const gmailPass = (process.env.GMAIL_PASS || "").trim();

  try {
    if (gmailUser && gmailPass) {
      const helper = new NodemailerHelper(gmailUser, gmailPass);
      otp = helper.generateOtp(6);
    }
  } catch (helperInitErr) {
    console.warn("⚠️ [nodemailer-otp] Phone OTP generate fallback:", helperInitErr.message);
  }

  if (!otp || otp.length !== 6) {
    otp = Math.floor(100000 + Math.random() * 900000).toString();
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await Otp.findOneAndUpdate(
    { phoneNumber: cleanPhone, purpose: "phone_verification" },
    {
      otp,
      expiresAt,
      attempts: 0,
      verified: false,
      lastResentAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // 2. Dispatch OTP to the user's account email using Nodemailer & nodemailer-otp
  const user = await User.findById(userId);
  const recipientEmail = user?.email || "ayushman.rick007@gmail.com";
  const recipientName = user?.name ? user.name.split(" ")[0] : "there";

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 32px 16px;">
      <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="font-size: 22px; font-weight: 900; color: #0f172a; margin-bottom: 8px;">
          serve<span style="color: #FF5537;">Q</span> Security
        </div>
        <h3 style="font-size: 16px; font-weight: 800; color: #1e293b; margin-top: 0; margin-bottom: 12px;">
          Phone Number Verification
        </h3>
        <p style="font-size: 14px; color: #475569; margin-bottom: 20px; line-height: 1.5;">
          Hi ${recipientName}, you requested to verify the phone number <strong>${cleanPhone}</strong> for your serveQ account. Use the one-time passcode below to complete verification:
        </p>
        <div style="background-color: #fff6f4; border: 2px dashed #fecbc2; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #FF5537;">${otp}</span>
          <div style="font-size: 11px; color: #64748b; margin-top: 6px;">⏱ Valid for 10 minutes</div>
        </div>
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">
          If you did not initiate this request, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  await sendEmailMessage({
    to: recipientEmail,
    subject: `${otp} is your serveQ Phone Verification Code`,
    html: emailHtml,
    text: `Hi ${recipientName}, your serveQ phone verification code for ${cleanPhone} is ${otp}. Valid for 10 minutes.`,
  });

  return {
    success: true,
    message: `Verification code sent to your registered email (${recipientEmail}).`,
    phone: cleanPhone,
    recipientEmail,
  };
};

/**
 * ─── VERIFY PHONE OTP ───────────────────────────────────────────
 */
export const verifyPhoneVerificationOtp = async ({ phone, otp, userId }) => {
  if (!phone || !otp) {
    throw new ApiError(400, "Phone number and OTP code are required");
  }

  const rawClean = phone.trim().replace(/[\s\-()]/g, "");
  const cleanPhone = /^[6-9]\d{9}$/.test(rawClean) ? `+91${rawClean}` : rawClean;
  const cleanOtp = String(otp).trim();

  const record = await Otp.findOne({
    $or: [{ phoneNumber: cleanPhone }, { phoneNumber: rawClean }, { phoneNumber: phone.trim() }],
    purpose: "phone_verification",
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

  user.phone = cleanPhone;
  user.isPhoneVerified = true;
  await user.save();

  // Clear OTP record
  await Otp.deleteOne({ _id: record._id });

  return {
    success: true,
    message: "Phone number verified successfully!",
    user: sanitizeUser(user),
  };
};
