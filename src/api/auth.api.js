import api from "./axios.js";

export const signup = (data) => api.post("/auth/signup", data);
export const signin = (data) => api.post("/auth/signin", data);
export const logout  = () => api.post("/auth/logout");
export const getBrowserSession = () => api.get("/auth/me?optional=1");
export const upgradeToOwner = () => api.post("/auth/upgrade-to-owner");

export const forgotPasswordSendOtp = (email) => api.post("/auth/forgot-password/send-otp", { email });
export const forgotPasswordVerifyOtp = (email, otp) => api.post("/auth/forgot-password/verify-otp", { email, otp });
export const forgotPasswordReset = (data) => api.post("/auth/forgot-password/reset-password", data);

export const sendWhatsAppPhoneOtp = (phone, turnstileToken) =>
  api.post("/auth/phone/send-otp", { phone, turnstileToken });
export const verifyWhatsAppPhoneOtp = data => api.post("/auth/phone/verify-otp", data);
export const sendPhoneSignInOtp = (phone, turnstileToken) => api.post('/auth/phone/signin/send-otp', { phone, turnstileToken });
export const verifyPhoneSignInOtp = data => api.post('/auth/phone/signin/verify-otp', data);
export const setWhatsAppConsent = (enabled, version) => api.patch("/auth/phone/whatsapp-consent", { enabled, version });
export const setVisitNoticeConsent = (enabled, version) => api.patch('/auth/phone/whatsapp-visit-consent', { enabled, version });
export const sendEmailOtp = (email) => api.post("/auth/email/send-otp", { email });
export const verifyEmailOtp = (email, otp) => api.post("/auth/email/verify-otp", { email, otp });


