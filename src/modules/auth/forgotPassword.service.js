import { isAdminAccessRequired } from "../../../middleware/admin-access.middleware.js";
import crypto from "node:crypto";
import { ownerState } from "../business-application/owner-lifecycle.js";
import { comparePassword, hashPassword } from "../auth.utils.js";
import User from "./auth.model.js";
import Otp from "./otp.model.js";
import { sendPasswordResetOtpEmail } from "../email/email.service.js";
import ApiError from "../../../utils/ApiError.js";
import { EMAIL_REGEX } from "./auth.service.js";

const purpose = "forgot_password";
const maxAttempts = 5;
const digestPattern = /^[a-f0-9]{64}$/;
const otpDigest = (email, challenge, otp) => crypto.createHmac("sha256", process.env.JWT_SECRET)
  .update(JSON.stringify([purpose, email, challenge, otp])).digest("hex");
const tokenDigest = token => crypto.createHash("sha256").update(token).digest("hex");

export const sendPasswordResetOtp = async (rawEmail) => {
  if (typeof rawEmail !== "string" || !rawEmail) throw new ApiError(400, "Email address is required");

  const email = rawEmail.toLowerCase().trim();
  if (!EMAIL_REGEX.test(email)) throw new ApiError(400, "Please enter a valid email address");

  const user = await User.findOne({ email });
  if (!user || (user.role === "admin" && isAdminAccessRequired())) throw new ApiError(404, "No account found with this email address");

  const otp = crypto.randomInt(100000, 1000000).toString();
  const challenge = crypto.randomBytes(16).toString("hex");
  const now = Date.now();
  try {
    // Use the account ID as this flow's record ID so concurrent sends cannot create two challenges.
    await Otp.findOneAndUpdate(
      { _id: user._id, purpose, $or: [
        { lastResentAt: { $lte: new Date(now - 30_000) } },
        { lastResentAt: { $exists: false } },
      ] },
      { $set: {
        email, challenge, otp: otpDigest(email, challenge, otp), accountTokenVersion: user.tokenVersion || 0,
        expiresAt: new Date(now + 600_000), attempts: 0, verified: false, lastResentAt: new Date(now),
      }, $unset: { resetToken: 1 } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    const cooldown = new ApiError(429, "Please wait 30 seconds before requesting a new verification code");
    cooldown.retryAfterSeconds = 30;
    throw cooldown;
  }

  const mailResult = await sendPasswordResetOtpEmail({ to: email, name: user.name, otp });
  if (!mailResult.sent && process.env.NODE_ENV !== "test") {
    throw new ApiError(503, "Failed to send recovery email. Please try again shortly.");
  }
  return { email, sent: mailResult.sent };
};

export const verifyPasswordResetOtp = async (rawEmail, rawOtp) => {
  if (typeof rawEmail !== "string" || !rawOtp) {
    throw new ApiError(400, "Email and 6-digit verification code are required");
  }
  const email = rawEmail.toLowerCase().trim();
  const otp = String(rawOtp).trim();
  const expired = () => new ApiError(400, "Verification code has expired or was not requested. Please request a new code.");
  const locked = () => new ApiError(429, "Too many failed attempts. Please request a new verification code.");
  const record = await Otp.findOne({ email, purpose, otp: digestPattern, verified: false, expiresAt: { $gt: new Date() } });
  if (!record?.challenge) throw expired();
  if (record.attempts >= maxAttempts) throw locked();

  const filter = {
    _id: record._id, purpose, challenge: record.challenge, otp: record.otp, verified: false,
    expiresAt: { $gt: new Date() }, attempts: { $lt: maxAttempts },
  };
  const suppliedDigest = otpDigest(email, record.challenge, otp);
  if (!crypto.timingSafeEqual(Buffer.from(record.otp, "hex"), Buffer.from(suppliedDigest, "hex"))) {
    const updated = await Otp.findOneAndUpdate(filter, { $inc: { attempts: 1 } }, { returnDocument: "after" });
    if (!updated) throw locked();
    throw new ApiError(400, "Invalid verification code. Please check the code or request a new one.");
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const claimed = await Otp.findOneAndUpdate(filter, {
    $set: { verified: true, resetToken: tokenDigest(resetToken) },
    $unset: { otp: 1 },
  }, { returnDocument: "after" });
  if (!claimed) throw expired();
  return { email, resetToken };
};

export const resetPassword = async ({ rawEmail, resetToken, otp, newPassword }) => {
  if (typeof rawEmail !== "string" || typeof newPassword !== "string" || !newPassword) {
    throw new ApiError(400, "Email and new password are required");
  }
  const email = rawEmail.toLowerCase().trim();
  if (newPassword.length < 8) throw new ApiError(400, "Password must be at least 8 characters long");
  if (!/[A-Z]/.test(newPassword)) throw new ApiError(400, "Password must contain at least one capital letter (A-Z)");
  if (!/[a-z]/.test(newPassword)) throw new ApiError(400, "Password must contain at least one lowercase letter (a-z)");
  if (!/[0-9]/.test(newPassword)) throw new ApiError(400, "Password must contain at least one number (0-9)");
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(newPassword)) throw new ApiError(400, "Password must contain at least one special symbol");

  const invalid = () => new ApiError(400, "Invalid or expired password reset session. Please request a new verification code.");
  const user = await User.findOne({ email }).select("+password");
  if (!user || (user.role === "admin" && isAdminAccessRequired())) throw invalid();
  if (user.ownerAccess?.applicationId && !["ACTIVE", "PASSWORD_REQUIRED"].includes(ownerState(user))) {
    throw new ApiError(403, "Complete invitation activation before resetting your password. Ask ServeQ to reissue an expired invitation.");
  }
  if (user.ownerAccess?.mustChangePassword && user.password && await comparePassword(newPassword, user.password)) {
    throw new ApiError(400, "Choose a different password from your temporary password.");
  }

  // Existing clients that submit the OTP directly use the same attempt counter and single-use exchange.
  const credential = resetToken ?? (otp ? (await verifyPasswordResetOtp(email, otp)).resetToken : null);
  if (typeof credential !== "string" || !digestPattern.test(credential)) throw invalid();
  const version = user.tokenVersion || 0;
  const proof = {
    _id: user._id, email, purpose, accountTokenVersion: version, verified: true,
    resetToken: tokenDigest(credential), expiresAt: { $gt: new Date() },
  };
  if (!await Otp.exists(proof)) throw invalid();

  const password = await hashPassword(newPassword);
  const consumed = await Otp.findOneAndDelete({ ...proof, expiresAt: { $gt: new Date() } });
  if (!consumed) throw invalid();

  const managedOwner = Boolean(user.ownerAccess?.applicationId);
  const versionFilter = version ? { tokenVersion: version } : { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] };
  const updated = await User.findOneAndUpdate({
    _id: user._id, email, password: user.password ?? null, ...versionFilter,
    ...(managedOwner && { "ownerAccess.status": "ACTIVE" }),
  }, {
    $set: {
      password,
      ...(user.authProvider === "google" && { authProvider: "both" }),
      ...(managedOwner && { "ownerAccess.mustChangePassword": false, "ownerAccess.passwordChangedAt": new Date() }),
    },
    $inc: { tokenVersion: 1 },
  });
  if (!updated) throw new ApiError(409, "Account changed. Please restart password recovery.");
  return { email, success: true };
};
