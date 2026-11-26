import { createRateLimiter } from "./rateLimiter.js";
import { EMAIL_REGEX } from "../modules/auth/auth.service.js";
import { normalizePhoneNumber } from "../utils/phoneNumbers.js";

const minute = 60_000;
const fiveMinutes = 5 * minute;
const userId = req => req.user?._id?.toString();
const emailKey = value => {
  if (typeof value !== "string" || value.length > 320) return null;
  const email = value.trim().toLowerCase();
  return EMAIL_REGEX.test(email) ? email : null;
};
const submittedEmail = req => emailKey(req.body?.email);
const profileEmail = req => emailKey(req.user.ownerAccess?.applicationId
  ? req.user.email : req.body?.email || req.user.email);
const profilePhone = req => normalizePhoneNumber(req.body?.phone || req.body?.phoneNumber || req.user.phone);

const byIp = (name, max, windowMs = minute, failOpen = false) =>
  createRateLimiter({ name: `${name}:ip`, max, windowMs, failOpen });
const byIdentity = (name, max, windowMs, key = userId) =>
  createRateLimiter({ name, max, windowMs, key });

export const signInLimit = [byIp("signin", 20), byIdentity("signin:email", 6, minute, submittedEmail)];
export const signupLimit = [byIp("signup", 10), byIdentity("signup:email", 3, minute, submittedEmail)];

const profileOtpUser = byIdentity("profile-otp-send:user", 6, fiveMinutes);
const profileOtpIp = byIp("profile-otp-send", 20, fiveMinutes);
export const emailOtpSendLimit = [profileOtpIp, profileOtpUser, byIdentity("email-otp-send:email", 3, fiveMinutes, profileEmail)];
export const phoneOtpSendLimit = [profileOtpIp, profileOtpUser, byIdentity("phone-otp-send:phone", 3, fiveMinutes, profilePhone)];
export const profileOtpVerifyLimit = byIdentity("profile-otp-verify:user", 10, fiveMinutes);
const signInPhone = req => normalizePhoneNumber(req.body?.phone);
export const phoneSignInSendLimit = [byIp('phone-signin-send', 15, fiveMinutes), byIdentity('phone-signin-send:phone', 3, fiveMinutes, signInPhone)];
export const phoneSignInVerifyLimit = [byIp('phone-signin-verify', 30, fiveMinutes), byIdentity('phone-signin-verify:phone', 10, fiveMinutes, signInPhone)];

export const resetSendLimit = [byIp("reset-send", 20, fiveMinutes), byIdentity("reset-send:email", 3, fiveMinutes, submittedEmail)];
export const resetVerifyLimit = [byIp("reset-verify", 30, fiveMinutes), byIdentity("reset-verify:email", 8, fiveMinutes, submittedEmail)];
export const resetCompleteLimit = [byIp("reset-complete", 20, fiveMinutes), byIdentity("reset-complete:email", 3, fiveMinutes, submittedEmail)];

export const accountSecurityLimit = byIdentity("account-security:user", 5, minute);
export const doctorAccessLimit = byIdentity("doctor-access:user", 5, minute);
export const walkInLimit = byIdentity('walk-in:user', 30, minute);
export const paymentSettingsLimit = byIdentity("payment-settings:user", 5, minute);
export const paymentOrderLimit = byIdentity("payment-order:user", 10, minute);
export const legacyOrderLimit = byIp("legacy-payment-order", 15);
export const mapsLimit = byIp("maps", 90, minute, true);
export const chatbotLimit = byIp("chatbot", 24);
export const businessApplicationLimit = byIp("business-application", 5, 60 * minute);
