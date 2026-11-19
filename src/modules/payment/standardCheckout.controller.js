import { getRazorpayClient, verifyPaymentSignature } from "./razorpay.service.js";

/**
 * Standard Razorpay Checkout - Create Order
 * POST /api/create-order
 * Request: { amount (paise), currency, receipt }
 * Return: { order_id, amount, currency, key_id }
 * Minimum amount: 100 paise
 */
export const createStandardOrder = async (req, res) => {
  try {
    const { amount, currency = "INR", receipt } = req.body;

    const numAmount = Number(amount);
    if (!Number.isSafeInteger(numAmount) || numAmount < 100) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Amount is required and must be at least 100 paise (₹1).",
      });
    }

    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({
        error: "Payment Unavailable",
        message: "Razorpay credentials are not configured or invalid on the server.",
      });
    }

    const options = {
      amount: Math.round(numAmount),
      currency: (currency || "INR").toUpperCase(),
      receipt: receipt || `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      order_id: order.id,
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      receipt: order.receipt,
      status: order.status,
    });
  } catch (err) {
    console.error("Razorpay create-order error:", { statusCode: err.statusCode });
    const statusCode = err.statusCode || (err.error?.code === "BAD_REQUEST_ERROR" ? 400 : 500);
    return res.status(statusCode).json({
      error: err.error?.code || "Razorpay API Error",
      message: "Unable to create a payment order. Please retry later.",
    });
  }
};

/**
 * Standard Razorpay Checkout - Verify Signature
 * POST /api/verify-payment
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Compare generated signature with razorpay_signature
 */
export const verifyStandardPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      order_id,
      razorpay_payment_id,
      payment_id,
      razorpay_signature,
      signature,
    } = req.body;

    const effectiveOrderId = razorpay_order_id || order_id;
    const effectivePaymentId = razorpay_payment_id || payment_id;
    const effectiveSignature = razorpay_signature || signature;

    if (!effectiveOrderId || !effectivePaymentId || !effectiveSignature) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: order_id, payment_id, and signature are all required.",
      });
    }

    const isMatch = verifyPaymentSignature({ razorpayOrderId: effectiveOrderId, razorpayPaymentId: effectivePaymentId, razorpaySignature: effectiveSignature });

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed: Signature mismatch.",
      });
    }

    const client = getRazorpayClient();
    if (!client) return res.status(503).json({ success: false, message: "Payment verification is unavailable" });
    let payment;
    let order;
    try { [payment, order] = await Promise.all([client.payments.fetch(effectivePaymentId), client.orders.fetch(effectiveOrderId)]); }
    catch { return res.status(502).json({ success: false, message: "Unable to confirm payment. Retry verification without paying again." }); }
    if (payment.id !== effectivePaymentId || payment.order_id !== effectiveOrderId || order.id !== effectiveOrderId ||
        payment.status !== "captured" || order.status !== "paid" || payment.amount !== order.amount || payment.currency !== order.currency) {
      return res.status(409).json({ success: false, message: "Payment has not been captured for this order" });
    }
    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order_id: effectiveOrderId,
      payment_id: effectivePaymentId,
    });
  } catch (err) {
    console.error("Razorpay verify-payment error:", { statusCode: err.statusCode });
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal server error during payment verification",
    });
  }
};
