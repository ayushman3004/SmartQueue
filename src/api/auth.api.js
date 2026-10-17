import api from "./axios.js";

export const signup = (data) => api.post("/auth/signup", data);
export const signin = (data) => api.post("/auth/signin", data);
export const logout  = () => api.post("/auth/logout");
export const getMe   = () => api.get("/auth/me");
export const upgradeToOwner = () => api.post("/auth/upgrade-to-owner");

export const forgotPasswordSendOtp = (email) => api.post("/auth/forgot-password/send-otp", { email });
export const forgotPasswordVerifyOtp = (email, otp) => api.post("/auth/forgot-password/verify-otp", { email, otp });
export const forgotPasswordReset = (data) => api.post("/auth/forgot-password/reset-password", data);

// Profile Contact Verification API (Phone & Email OTP via Nodemailer & nodemailer-otp)
export const sendPhoneOtp = (phone) => api.post("/auth/phone/send-otp", { phone });
export const verifyPhoneOtp = (phone, otp) => api.post("/auth/phone/verify-otp", { phone, otp });
export const confirmFirebasePhone = (phone, idToken) => api.post("/auth/phone/verify-firebase", { phone, idToken });
export const sendEmailOtp = (email) => api.post("/auth/email/send-otp", { email });
export const verifyEmailOtp = (email, otp) => api.post("/auth/email/verify-otp", { email, otp });


