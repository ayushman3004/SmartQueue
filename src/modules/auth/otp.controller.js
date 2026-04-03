import Otp from "./otp.model.js";
import User from "./auth.model.js";
import { sendSMS } from "../../services/twilioService.js";
import { generateToken, setTokenCookie } from "../auth.utils.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

export const sendOtp = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json(new ApiResponse(400, null, "Phone number is required"));
  }

  // Cooldown check (30 seconds)
  const existingOtp = await Otp.findOne({ phoneNumber });
  if (existingOtp && (Date.now() - new Date(existingOtp.updatedAt).getTime() < 30000)) {
    return res.status(429).json(new ApiResponse(429, null, "Please wait 30 seconds before requesting another OTP"));
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store OTP (overwrite if exists)
  await Otp.findOneAndUpdate(
    { phoneNumber },
    { otp, expiresAt, attempts: 0 },
    { upsert: true, new: true }
  );

  // Send via Twilio
  const messageBody = `Your Smart Queue OTP is ${otp}. Valid for 5 minutes.`;
  await sendSMS(phoneNumber, messageBody);

  res.status(200).json(new ApiResponse(200, null, "OTP sent successfully"));
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { phoneNumber, otp } = req.body;
  if (!phoneNumber || !otp) {
    return res.status(400).json(new ApiResponse(400, null, "Phone number and OTP are required"));
  }

  const otpRecord = await Otp.findOne({ phoneNumber });

  if (!otpRecord) {
    return res.status(400).json(new ApiResponse(400, null, "OTP expired or not found"));
  }

  if (otpRecord.attempts >= 3) {
    return res.status(403).json(new ApiResponse(403, null, "Too many failed attempts. Please request a new OTP."));
  }

  if (otpRecord.otp !== otp) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return res.status(400).json(new ApiResponse(400, null, `Invalid OTP. ${3 - otpRecord.attempts} attempts remaining.`));
  }

  // OTP verified - check if user exists
  let user = await User.findOne({ phone: phoneNumber });

  if (!user) {
    // Create new user (placeholder details if needed, name is required in schema)
    user = await User.create({
      name: `User ${phoneNumber.slice(-4)}`,
      phone: phoneNumber,
      email: `${phoneNumber}@smartqueue.internal`, // unique email requirement
      authProvider: "local",
      role: "customer"
    });
  }

  // Cleanup OTP
  await Otp.deleteOne({ phoneNumber });

  // Generate JWT and set cookie
  const token = generateToken(user);
  setTokenCookie(res, token);

  res.status(200).json(new ApiResponse(200, {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone
    },
    token
  }, "Login successful"));
});
