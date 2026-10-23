import User from "../auth/auth.model.js";
import Business from "../business/business.model.js";
import ApiError from "../../../utils/ApiError.js";
import {
  getRazorpayClient,
  verifyPaymentSignature,
} from "../payment/razorpay.service.js";

export const SUBSCRIPTION_PLANS = {
  BASIC: {
    id: "BASIC",
    name: "Basic Plan",
    price: 999,
    amountInPaise: 99900,
    interval: "monthly",
    durationDays: 30,
    tagline: "Essential virtual queue & appointment management for small venues.",
    features: [
      "Standard Virtual Live Queue & Slot Scheduling",
      "Up to 3 Active Staff / Service Providers",
      "Counter Payments with UPI QR & Cash Tracking",
      "Automated SMS & Web Wait-Time Notifications",
      "Standard Daily Venue Traffic & Volume Analytics",
      "Community & Email Support",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro Plan",
    price: 1999,
    amountInPaise: 199900,
    interval: "monthly",
    durationDays: 30,
    tagline: "Advanced capabilities, direct online settlements, and AI intelligence for high-traffic venues.",
    badge: "Most Popular",
    features: [
      "Unlimited Staff Members & Multi-Room Queues",
      "Razorpay Direct Online Payment & Instant Settlements",
      "AI Predictive Peak-Hour & Revenue Analytics",
      "Express VIP Queue Passes & Priority Routing",
      "Custom Automated SMS & WhatsApp Status Alerts",
      "Multi-Service Dynamic Service Sequencing",
      "Dedicated 24/7 Account Manager & Phone Support",
    ],
  },
};

/**
 * Creates a Razorpay order specifically for ServeQ platform subscription
 */
export const createSubscriptionOrder = async (userId, planId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (!["owner", "admin"].includes(user.role)) {
    throw new ApiError(403, "Only registered business owners can subscribe to ServeQ plans");
  }

  const normalizedPlanId = String(planId || "").toUpperCase();
  const plan = SUBSCRIPTION_PLANS[normalizedPlanId];
  if (!plan) {
    throw new ApiError(400, "Invalid plan selected. Choose either BASIC (₹999) or PRO (₹1,999).");
  }

  const razorpay = getRazorpayClient();
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const receipt = `sub_${userId.toString().slice(-10)}_${Date.now()}`.slice(-40);

  if (!razorpay) {
    // Development / Mock mode
    return {
      order: {
        id: `order_mock_sub_${Date.now()}`,
        amount: plan.amountInPaise,
        currency: "INR",
        status: "created",
        isMock: true,
        keyId: keyId || "rzp_test_placeholder",
      },
      plan,
    };
  }

  try {
    const order = await razorpay.orders.create({
      amount: plan.amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        type: "SERVEQ_BUSINESS_SUBSCRIPTION",
        plan: plan.id,
        userId: user._id.toString(),
        userEmail: user.email,
        userName: user.name,
      },
    });

    return {
      order: {
        ...order,
        keyId,
        isMock: false,
      },
      plan,
    };
  } catch (err) {
    console.error("Razorpay subscription order creation failed:", err);
    throw new ApiError(502, `Failed to create Razorpay subscription order: ${err.message}`);
  }
};

/**
 * Verifies Razorpay payment signature and activates the chosen plan for the business owner
 */
export const verifySubscriptionPayment = async (
  userId,
  { plan, razorpayOrderId, razorpayPaymentId, razorpaySignature }
) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const normalizedPlanId = String(plan || "").toUpperCase();
  const selectedPlan = SUBSCRIPTION_PLANS[normalizedPlanId];
  if (!selectedPlan) {
    throw new ApiError(400, "Invalid plan selected. Must be BASIC or PRO.");
  }

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new ApiError(400, "Missing required Razorpay payment verification parameters");
  }

  // Cryptographic HMAC SHA256 Signature Verification
  const isSignatureValid = verifyPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  if (!isSignatureValid) {
    throw new ApiError(400, "Invalid Razorpay payment signature. Subscription activation aborted.");
  }

  const activatedAt = new Date();
  const expiresAt = new Date(Date.now() + selectedPlan.durationDays * 24 * 60 * 60 * 1000);

  // Update user subscription state
  user.subscription = {
    plan: selectedPlan.id,
    status: "ACTIVE",
    amount: selectedPlan.price,
    activatedAt,
    expiresAt,
    razorpayOrderId,
    razorpayPaymentId,
  };

  await user.save();

  // Cascade plan update to all businesses owned by this owner
  await Business.updateMany(
    { owner: user._id },
    {
      $set: {
        "subscription.plan": selectedPlan.id,
        "subscription.status": "ACTIVE",
        "subscription.amount": selectedPlan.price,
        "subscription.expiresAt": expiresAt,
      },
    }
  );

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

/**
 * Retrieves current active subscription details and plan offerings
 */
export const getCurrentSubscription = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const sub = user.subscription || { plan: "NONE", status: "INACTIVE", amount: 0 };
  const currentPlan = SUBSCRIPTION_PLANS[sub.plan] || null;

  const isExpired = sub.expiresAt && new Date(sub.expiresAt) < new Date();
  const effectiveStatus = isExpired ? "EXPIRED" : sub.status;

  return {
    subscription: {
      ...sub.toObject ? sub.toObject() : sub,
      status: effectiveStatus,
    },
    currentPlan,
    availablePlans: SUBSCRIPTION_PLANS,
  };
};
