import axios from "./axios";

// Public payment configuration (e.g. Razorpay key ID)
export const getPaymentConfig = () => axios.get("/payments/config");

// Create Razorpay payment order for booking
export const createBookingOrder = (bookingId) =>
  axios.post("/payments/create-order", { bookingId });

// Verify Razorpay payment signature
export const verifyPayment = (paymentData) =>
  axios.post("/payments/verify", paymentData);

// Business payment account status & Route connection
export const getBusinessPaymentStatus = (businessId) =>
  axios.get(`/payments/business/${businessId}/status`);

export const connectRouteAccount = (businessId, data) =>
  axios.post(`/payments/business/${businessId}/connect-route`, data);

export const updatePaymentModes = (businessId, data) =>
  axios.put(`/payments/business/${businessId}/modes`, data);

// Staff / Owner marks counter payment collected
export const collectCounterPayment = (bookingId) =>
  axios.patch(`/bookings/${bookingId}/collect-payment`);
