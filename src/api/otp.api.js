import axios from "./axios";

export const sendOtp = async (phoneNumber) => {
  return await axios.post("/otp/send", { phoneNumber });
};

export const verifyOtp = async (phoneNumber, otp, role) => {
  return await axios.post("/otp/verify", { phoneNumber, otp, role });
};
