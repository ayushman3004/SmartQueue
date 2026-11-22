import express from "express";
import { sendOtp, verifyOtp } from "./otp.controller.js";
import { loginOtpSendLimit, loginOtpVerifyLimit } from "../../gateway/endpointRateLimits.js";

const router = express.Router();

router.post("/send", loginOtpSendLimit, sendOtp);
router.post("/verify", loginOtpVerifyLimit, verifyOtp);

export default router;
