import User from "../auth/auth.model.js";
import Business from "../business/business.model.js";
import SubscriptionOrder from "./subscription-order.model.js";
import { SUBSCRIPTION_PLANS } from "../../shared/subscriptionPlans.js";
import ApiError from "../../../utils/ApiError.js";

// Both authenticated Checkout callbacks and signed webhooks use the same persisted dates.
export const activateSubscriptionPurchase = async (user, purchase, selectedPlan, razorpayPaymentId) => {
  const razorpayOrderId = purchase.orderId;
  if (purchase.paymentId && purchase.paymentId !== razorpayPaymentId) {
    throw new ApiError(409, "Order already verified with another payment.");
  }
  // Store the entitlement dates once. Retried callbacks must never add another month.
  if (!purchase.activatedAt) {
    const activatedAt = new Date();
    const renewalBase = user.subscription?.plan === selectedPlan.id && user.subscription?.status === "ACTIVE"
      ? Math.max(Date.now(), new Date(user.subscription.expiresAt || 0).getTime()) : Date.now();
    const updated = await SubscriptionOrder.findOneAndUpdate(
      { _id: purchase._id, activatedAt: null },
      { $set: { paymentId: razorpayPaymentId, activatedAt, expiresAt: new Date(renewalBase + selectedPlan.durationDays * 86400000) } },
      { new: true }
    );
    purchase = updated || await SubscriptionOrder.findById(purchase._id);
  }
  if (!purchase?.activatedAt || purchase.paymentId !== razorpayPaymentId) {
    throw new ApiError(409, "Subscription order was activated with another payment or is unavailable.");
  }
  // An old callback cannot replace a newer purchased plan.
  if (!user.subscription?.activatedAt || new Date(user.subscription.activatedAt) <= new Date(purchase.activatedAt)) {
    user.subscription = {
      plan: selectedPlan.id, status: "ACTIVE", amount: purchase.amount / 100,
      activatedAt: purchase.activatedAt, expiresAt: purchase.expiresAt,
      razorpayOrderId, razorpayPaymentId,
    };
    await user.save();
  }
  await Business.updateMany({ owner: user._id }, { $set: {
    "subscription.plan": user.subscription.plan, "subscription.status": user.subscription.status,
    "subscription.amount": user.subscription.amount, "subscription.expiresAt": user.subscription.expiresAt,
  } });

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscription: user.subscription,
    },
    subscription: user.subscription,
    planDetails: selectedPlan,
  };
};

// Called only after the controller authenticates the exact webhook request bytes.
export const processSubscriptionWebhook = async (event) => {
  if (!["payment.captured", "order.paid", "payment.failed"].includes(event.event)) return null;
  const payment = event.payload?.payment?.entity;
  const order = event.payload?.order?.entity;
  const orderId = payment?.order_id || order?.id;
  if (!orderId) return null;
  const purchase = await SubscriptionOrder.findOne({ orderId });
  if (!purchase) {
    // Razorpay can deliver before the order creation request finishes persisting.
    if (payment?.notes?.type === "SERVEQ_BUSINESS_SUBSCRIPTION" || order?.notes?.type === "SERVEQ_BUSINESS_SUBSCRIPTION") {
      throw new ApiError(503, "Subscription order is not available yet. Retry webhook delivery.");
    }
    return null;
  }
  if (event.event === "payment.failed") return { status: "ignored_subscription_payment_failure", orderId };
  if (!payment || !/^pay_[A-Za-z0-9]+$/.test(payment.id || "") || payment.order_id !== purchase.orderId ||
      payment.status !== "captured" || payment.amount !== purchase.amount || payment.currency !== "INR") {
    throw new ApiError(400, "Webhook payment does not match the subscription order.");
  }
  if (event.event === "order.paid" && (!order || order.id !== purchase.orderId || order.status !== "paid" ||
      order.amount !== purchase.amount || order.amount_paid !== purchase.amount || order.currency !== "INR")) {
    throw new ApiError(400, "Webhook subscription order is not fully paid.");
  }
  for (const notes of [payment.notes, order?.notes]) {
    if ((notes?.userId && String(notes.userId) !== String(purchase.owner)) ||
        (notes?.plan && notes.plan !== purchase.plan)) {
      throw new ApiError(400, "Webhook subscription reference does not match the purchase.");
    }
  }
  const plan = SUBSCRIPTION_PLANS[purchase.plan];
  if (!plan) throw new ApiError(409, "Subscription order has an unsupported plan.");
  const user = await User.findById(purchase.owner);
  if (!user) throw new ApiError(404, "Subscription owner not found.");
  if (!["owner", "admin"].includes(user.role)) throw new ApiError(403, "Only business owners can subscribe.");
  await activateSubscriptionPurchase(user, purchase, plan, payment.id);
  return { status: "processed", eventType: event.event, subscriptionOrderId: purchase.orderId };
};
