import axios from "./axios";

export const sendOtp = async (phoneNumber) => {
  return await axios.post("/api/otp/send", { phoneNumber });
};

export const verifyOtp = async (phoneNumber, otp) => {
  return await axios.post("/api/otp/verify", { phoneNumber, otp });
};
