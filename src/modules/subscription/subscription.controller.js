import {
  createSubscriptionOrder,
  verifySubscriptionPayment,
  getCurrentSubscription,
  SUBSCRIPTION_PLANS,
} from "./subscription.service.js";
import ApiResponse from "../../../utils/ApiResponse.js";

export const getPlansHandler = async (req, res, next) => {
  try {
    return res.status(200).json(
      new ApiResponse(200, { plans: SUBSCRIPTION_PLANS }, "Subscription plans retrieved")
    );
  } catch (err) {
    next(err);
  }
};

export const createOrderHandler = async (req, res, next) => {
  try {
    const { plan } = req.body;
    const result = await createSubscriptionOrder(req.user._id, plan);
    return res.status(200).json(
      new ApiResponse(200, result, "Razorpay subscription order created successfully")
    );
  } catch (err) {
    next(err);
  }
};

export const verifyPaymentHandler = async (req, res, next) => {
  try {
    const result = await verifySubscriptionPayment(req.user._id, req.body);
    return res.status(200).json(
      new ApiResponse(200, result, "Subscription payment verified and plan activated!")
    );
  } catch (err) {
    next(err);
  }
};

export const getCurrentSubscriptionHandler = async (req, res, next) => {
  try {
    const result = await getCurrentSubscription(req.user._id);
    return res.status(200).json(
      new ApiResponse(200, result, "Current subscription retrieved")
    );
  } catch (err) {
    next(err);
  }
};
