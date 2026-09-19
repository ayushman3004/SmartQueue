import crypto from "crypto";

/**
 * Base Payment Provider Interface
 */
export class PaymentProvider {
  /**
   * @param {Object} params - { amount, currency, customerId, customerEmail, description, metadata }
   */
  async createPaymentOrder(_params) {
    throw new Error("Method createPaymentOrder() must be implemented");
  }

  /**
   * @param {Object} params - { orderId, paymentId, signature, expectedAmount }
   */
  async verifyPayment(_params) {
    throw new Error("Method verifyPayment() must be implemented");
  }

  /**
   * @param {Object} params - { paymentId, amount, reason }
   */
  async processRefund(_params) {
    throw new Error("Method processRefund() must be implemented");
  }
}

/**
 * Clearly Labeled Mock Payment Provider (Test Mode)
 * Used when production payment gateway keys (e.g. Razorpay/Stripe) are not configured.
 */
export class MockPaymentProvider extends PaymentProvider {
  constructor() {
    super();
    this.name = "MockPaymentProvider (Test Mode)";
    this.isMock = true;
  }

  async createPaymentOrder({ amount, currency = "INR", customerId, description, metadata = {} }) {
    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      throw new Error("Payment amount must be a positive finite number");
    }

    const orderId = `order_mock_${crypto.randomBytes(8).toString("hex")}`;
    return {
      success: true,
      provider: this.name,
      orderId,
      amount,
      currency,
      customerId,
      description: description || "serveQ Booking & Queue Deposit",
      metadata,
      status: "created",
      createdAt: new Date().toISOString(),
    };
  }

  async verifyPayment({ orderId, paymentId, amount }) {
    if (!orderId) {
      throw new Error("orderId is required for payment verification");
    }
    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      throw new Error("Valid positive amount is required for verification");
    }

    const verifiedPaymentId = paymentId || `pay_mock_${crypto.randomBytes(8).toString("hex")}`;
    return {
      success: true,
      verified: true,
      provider: this.name,
      orderId,
      paymentId: verifiedPaymentId,
      amount,
      status: "paid",
      verifiedAt: new Date().toISOString(),
      label: "Verified by Mock Payment Gateway (Test Mode)",
    };
  }

  async processRefund({ paymentId, amount, reason = "Customer cancellation" }) {
    if (!paymentId) throw new Error("paymentId is required for refund");
    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      throw new Error("Refund amount must be a positive finite number");
    }

    const refundId = `ref_mock_${crypto.randomBytes(8).toString("hex")}`;
    return {
      success: true,
      provider: this.name,
      refundId,
      paymentId,
      amount,
      reason,
      status: "refunded",
      refundedAt: new Date().toISOString(),
    };
  }
}

// Active singleton provider
let activeProvider = null;

export const getPaymentProvider = () => {
  if (!activeProvider) {
    activeProvider = new MockPaymentProvider();
  }
  return activeProvider;
};
