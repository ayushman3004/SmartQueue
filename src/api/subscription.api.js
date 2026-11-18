import axios from "./axios";

// Get available subscription plan definitions
export const getSubscriptionPlans = () => axios.get("/subscriptions/plans");

// Get current user's active subscription status
export const getCurrentSubscription = () => axios.get("/subscriptions/current");

// Create Razorpay order to pay for Basic (799) or Pro (1499) plan
export const createSubscriptionOrder = (plan) =>
  axios.post("/subscriptions/create-order", { plan });

// Verify Razorpay payment signature & activate plan
export const verifySubscriptionPayment = (paymentData) =>
  axios.post("/subscriptions/verify", paymentData);
