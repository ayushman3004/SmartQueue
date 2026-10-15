import crypto from "crypto";
import User from "./auth.model.js";
import Otp from "./otp.model.js";
import { hashPassword } from "../auth.utils.js";
import { sendPasswordResetOtpEmail } from "../email/email.service.js";
import ApiError from "../../../utils/ApiError.js";
import { EMAIL_REGEX } from "./auth.service.js";

/**
 * Step 1: Send a 6-digit OTP to the user's registered email via Nodemailer.
 */
export const sendPasswordResetOtp = async (rawEmail) => {
  if (!rawEmail || typeof rawEmail !== "string") {
    throw new ApiError(400, "Email address is required");
  }

  const email = rawEmail.toLowerCase().trim();
  if (!EMAIL_REGEX.test(email)) {
    throw new ApiError(400, "Please enter a valid email address");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "No account found with this email address");
  }

  // Cooldown check (30 seconds) to prevent spamming
  const existingOtp = await Otp.findOne({ email, purpose: "forgot_password" });
  if (existingOtp && Date.now() - new Date(existingOtp.lastResentAt).getTime() < 30000) {
    const waitSec = Math.ceil((30000 - (Date.now() - new Date(existingOtp.lastResentAt).getTime())) / 1000);
    throw new ApiError(429, `Please wait ${waitSec} seconds before requesting a new verification code`);
  }

  // Generate a cryptographically secure 6-digit numeric OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  // Upsert OTP record
  await Otp.findOneAndUpdate(
    { email, purpose: "forgot_password" },
    {
      otp,
      expiresAt,
      attempts: 0,
      verified: false,
      resetToken: null,
      lastResentAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // Send via Nodemailer
  const mailResult = await sendPasswordResetOtpEmail({
    to: email,
    name: user.name,
    otp,
  });

  return {
    email,
    simulated: mailResult.simulated || false,
    ...(process.env.NODE_ENV !== "production" && mailResult.simulated ? { debugOtp: otp } : {}),
  };
};

/**
 * Step 2: Verify the 6-digit OTP code entered by the user.
 * Generates and returns a single-use secure reset token on success.
 */
export const verifyPasswordResetOtp = async (rawEmail, rawOtp) => {
  if (!rawEmail || !rawOtp) {
    throw new ApiError(400, "Email and 6-digit verification code are required");
  }

  const email = rawEmail.toLowerCase().trim();
  const otp = String(rawOtp).trim();

  const record = await Otp.findOne({ email, purpose: "forgot_password" });

  if (!record || new Date() > record.expiresAt) {
    throw new ApiError(400, "Verification code has expired or was not requested. Please request a new code.");
  }

  if (record.attempts >= 5) {
    throw new ApiError(429, "Too many failed attempts. Please request a new verification code.");
  }

  if (record.otp !== otp) {
    record.attempts += 1;
    await record.save();
    const remaining = 5 - record.attempts;
    throw new ApiError(400, `Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Please request a new code."}`);
  }

  // Generate secure single-use reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  record.verified = true;
  record.resetToken = resetToken;
  await record.save();

  return {
    email,
    resetToken,
  };
};

/**
 * Step 3: Reset password using the verified resetToken (or directly validated OTP).
 */
export const resetPassword = async ({ rawEmail, resetToken, otp, newPassword }) => {
  if (!rawEmail || !newPassword) {
    throw new ApiError(400, "Email and new password are required");
  }

  const email = rawEmail.toLowerCase().trim();

  // Validate strict password strength requirements
  if (newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(newPassword)) {
    throw new ApiError(400, "Password must contain at least one capital letter (A-Z)");
  }
  if (!/[a-z]/.test(newPassword)) {
    throw new ApiError(400, "Password must contain at least one lowercase letter (a-z)");
  }
  if (!/[0-9]/.test(newPassword)) {
    throw new ApiError(400, "Password must contain at least one number (0-9)");
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(newPassword)) {
    throw new ApiError(400, "Password must contain at least one special symbol (!@#$%^&*...)");
  }

  let record = null;

  if (resetToken) {
    record = await Otp.findOne({
      email,
      resetToken,
      verified: true,
      purpose: "forgot_password",
      expiresAt: { $gt: new Date() },
    });
  } else if (otp) {
    record = await Otp.findOne({
      email,
      otp: String(otp).trim(),
      purpose: "forgot_password",
      expiresAt: { $gt: new Date() },
    });
  }

  if (!record) {
    throw new ApiError(400, "Invalid or expired password reset session. Please request a new verification code.");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User account not found");
  }

  const hashedPassword = await hashPassword(newPassword);
  user.password = hashedPassword;
  if (user.authProvider === "google") {
    user.authProvider = "both";
  }
  await user.save();

  // Invalidate OTP record so token cannot be reused
  await Otp.deleteMany({ email, purpose: "forgot_password" });

  return {
    email,
    success: true,
  };
};
