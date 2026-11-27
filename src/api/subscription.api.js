import axios from "./axios";

export const redeemSubscriptionCoupon = (code) => axios.post("/subscriptions/redeem-coupon", { code }, { timeout: 25000 });

// Get available subscription plan definitions
export const getSubscriptionPlans = () => axios.get("/subscriptions/plans");

// Get current user's active subscription status
export const getCurrentSubscription = () => axios.get("/subscriptions/current");

// Create a Razorpay order for a subscription plan
export const createSubscriptionOrder = (plan) =>
  axios.post("/subscriptions/create-order", { plan }, { timeout: 25000 });

// Verify Razorpay payment signature & activate plan
export const verifySubscriptionPayment = (paymentData) =>
  axios.post("/subscriptions/verify", paymentData, { timeout: 25000 });
