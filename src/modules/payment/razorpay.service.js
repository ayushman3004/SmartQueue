import crypto from "crypto";
import Razorpay from "razorpay";
import Booking from "../../booking/booking.model.js";
import Business from "../business/business.model.js";
import ApiError from "../../../utils/ApiError.js";

import { readRazorpayCredentials, classifyRazorpayOrderError } from "./razorpay.config.js";

// Recreate the SDK when either half of the configured pair changes.
let currentKeyId = null;
let currentSecret = null;
let razorpayClient = null;

export const getRazorpayClient = () => {
  const { keyId, secret, configured } = readRazorpayCredentials();
  if (!configured) return null;
  if (!razorpayClient || currentKeyId !== keyId || currentSecret !== secret) {
    currentKeyId = keyId;
    currentSecret = secret;
    razorpayClient = new Razorpay({ key_id: keyId, key_secret: secret });
  }
  return razorpayClient;
};

export const isRazorpayConfigured = () => readRazorpayCredentials().configured;

export const getPublicPaymentConfig = () => {
  const { keyId, configured } = readRazorpayCredentials();
  return { keyId: configured ? keyId : "", isConfigured: configured, currency: "INR", isTestMode: !keyId.startsWith("rzp_live_") };
};

/**
 * Verifies Razorpay checkout payment signature using HMAC SHA256
 */
export const verifyPaymentSignature = ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  secretOverride = null,
}) => {
  const secret = secretOverride ?? (readRazorpayCredentials().configured ? readRazorpayCredentials().secret : null);
  if (typeof secret !== "string" || !secret) throw new ApiError(503, "Payment verification is not configured");
  if (typeof razorpayOrderId !== "string" || typeof razorpayPaymentId !== "string" ||
      !/^order_[A-Za-z0-9_]+$/.test(razorpayOrderId) || !/^pay_[A-Za-z0-9_]+$/.test(razorpayPaymentId) ||
      razorpayOrderId.startsWith("order_mock_") || razorpayPaymentId.startsWith("pay_mock_") ||
      typeof razorpaySignature !== "string" || !/^[a-f0-9]{64}$/i.test(razorpaySignature)) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(razorpaySignature, "hex"));
};

/** Verify the exact bytes received from Razorpay, never reconstructed JSON. */
export const verifyWebhookSignature = (rawBody, signature, secretOverride = null) => {
  const secret = secretOverride ?? process.env.RAZORPAY_WEBHOOK_SECRET;
  if (typeof secret !== "string" || !secret.trim() || /placeholder|your[_-]|xxxxx/i.test(secret)) {
    throw new ApiError(503, "Razorpay webhook verification is not configured");
  }
  if (!Buffer.isBuffer(rawBody) || !rawBody.length || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"));
};

export const bookingPaymentAmount = booking => {
  const amount = booking.razorpayOrderAmount || Math.round(Number(booking.amount || booking.paidAmount) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new ApiError(400, "Invalid booking payment amount");
  return amount;
};

export const confirmRazorpayPaymentForBooking = async (booking, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  if (!booking.razorpayOrderId || booking.razorpayOrderId !== razorpayOrderId) throw new ApiError(400, "Payment order does not match this booking");
  if (!verifyPaymentSignature({ razorpayOrderId: booking.razorpayOrderId, razorpayPaymentId, razorpaySignature })) throw new ApiError(400, "Invalid payment signature");
  if (["cancelled", "refunded"].includes(booking.status) || ["refunded", "partially_refunded"].includes(booking.paymentStatus)) throw new ApiError(409, "This booking cannot be confirmed by payment");
  const client = getRazorpayClient();
  if (!client) throw new ApiError(503, "Payment verification is unavailable");
  let payment;
  try { payment = await client.payments.fetch(razorpayPaymentId); }
  catch { throw new ApiError(502, "Unable to confirm payment. Retry verification without paying again."); }
  if (payment.id !== razorpayPaymentId || payment.order_id !== booking.razorpayOrderId || payment.amount !== bookingPaymentAmount(booking) ||
      payment.currency !== (booking.currency || "INR") || payment.status !== "captured") throw new ApiError(409, "Payment is not yet confirmed for this booking");
  if (booking.paymentStatus === "paid") {
    if (booking.razorpayPaymentId && booking.razorpayPaymentId !== razorpayPaymentId) throw new ApiError(409, "Booking was paid with another payment");
    return false;
  }
  booking.paymentStatus = "paid";
  if (booking.status === "pending_payment" || booking.status === "scheduled") booking.status = "confirmed";
  booking.paymentMethod = "online";
  booking.razorpayPaymentId = payment.id;
  booking.razorpaySignature = razorpaySignature;
  booking.paidAt = new Date();
  booking.paidAmount = payment.amount / 100;
  await booking.save();
  return true;
};

/**
 * Creates a Razorpay Order for a Booking with Route Transfer to Connected Business.
 * Recalculates amount strictly from server-side booking.
 */
export const createRazorpayOrderForBooking = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId).populate("businessId");
  if (!booking) throw new ApiError(404, "Booking not found");

  if (booking.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to pay for this booking");
  }

  if (booking.paymentStatus === "paid") {
    throw new ApiError(400, "This booking has already been paid");
  }

  const business = booking.businessId;
  if (!business) throw new ApiError(404, "Associated business not found");

  // Re-verify that business is active and eligible for online payments
  const isOnlineActive =
    business.paymentConfiguration?.onlinePaymentStatus === "ACTIVE" &&
    ["ONLINE", "BOTH"].includes(business.paymentConfiguration?.paymentMode);

  if (!isOnlineActive) {
    throw new ApiError(
      400,
      "This business is currently only accepting Pay at Counter. Online payments are unavailable."
    );
  }

  const linkedAccountId = business.paymentConfiguration?.providerAccountReference;
  if (!linkedAccountId) {
    throw new ApiError(
      400,
      "This business does not have an active Razorpay Route linked account configured."
    );
  }

  // Calculate amount in paise (1 INR = 100 paise)
  const amountInRupees = booking.amount || booking.paidAmount || 0;
  if (amountInRupees <= 0) {
    throw new ApiError(400, "Payable amount must be greater than zero");
  }
  const amountInPaise = Math.round(amountInRupees * 100);

  const rzp = getRazorpayClient();

  if (!rzp) throw new ApiError(503, "Online payments are not configured. Use Pay at Counter or contact support.");
  if (typeof linkedAccountId !== "string" || !/^acc_[A-Za-z0-9]+$/.test(linkedAccountId)) throw new ApiError(409, "The linked payment account requires provider verification.");
  if (["cancelled", "refunded"].includes(booking.status) || ["refunded", "partially_refunded"].includes(booking.paymentStatus)) throw new ApiError(409, "This booking cannot accept another payment");
  if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) throw new ApiError(400, "Invalid payable amount");

  // Create order with Razorpay Route transfers directly to connected account
  const orderOptions = {
    amount: amountInPaise,
    currency: "INR",
    receipt: `rcpt_${booking._id.toString().slice(-10)}`,
    notes: {
      bookingId: booking._id.toString(),
      businessId: business._id.toString(),
      customerId: userId.toString(),
      businessName: business.name,
    },
  };

  // Route Transfer: Attach linked account settlement if account ID is set
  if (linkedAccountId && linkedAccountId.startsWith("acc_")) {
    orderOptions.transfers = [
      {
        account: linkedAccountId,
        amount: amountInPaise,
        currency: "INR",
        notes: {
          bookingId: booking._id.toString(),
          businessId: business._id.toString(),
          businessName: business.name,
        },
        on_hold: false,
      },
    ];
  }

  try {
    const order = await rzp.orders.create(orderOptions);
    if (!order || typeof order.id !== "string" || !/^order_[A-Za-z0-9]+$/.test(order.id) || order.amount !== amountInPaise || order.currency !== "INR") throw new ApiError(502, "Invalid provider order response");

    booking.razorpayOrderId = order.id;
    booking.razorpayOrderAmount = amountInPaise;
    booking.paymentMethod = "online";
    booking.paymentStatus = "pending";
    booking.amount = amountInRupees;
    await booking.save();

    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: readRazorpayCredentials().keyId,
      businessName: business.name,
      notes: order.notes,
    };
  } catch (err) {
    const diagnostic = classifyRazorpayOrderError(err);
    console.error("[booking-payment-order]", { kind: diagnostic.kind, providerStatus: diagnostic.providerStatus });
    throw new ApiError(502, "Razorpay could not create the payment order. Please retry later.");
  }
};

/**
 * Onboards or links a business to Razorpay Route
 */
export const connectRazorpayRouteAccount = async (businessId, ownerUser, payload = {}) => {
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  const legalBusinessName = payload.legalBusinessName || business.name;
  const businessType = payload.businessType || "individual";
  if (payload.accountId != null && typeof payload.accountId !== "string") throw new ApiError(400, "Invalid linked account ID");
  const providedAccountId = payload.accountId?.trim();

  const rzp = getRazorpayClient();
  if (!rzp) throw new ApiError(503, "Payment account connection is not configured");
  if (providedAccountId) {
    if (!/^acc_[A-Za-z0-9]+$/.test(providedAccountId)) throw new ApiError(400, "Invalid linked account ID");
    let account;
    try { account = await rzp.accounts.fetch(providedAccountId); }
    catch { throw new ApiError(502, "Unable to verify the linked account with Razorpay"); }
    if (!account || account.id !== providedAccountId) throw new ApiError(400, "Linked account could not be verified");
    if (account.notes?.businessId && String(account.notes.businessId) !== String(business._id)) throw new ApiError(403, "Linked account belongs to another business");
    business.paymentConfiguration.providerAccountReference = account.id;
    business.paymentConfiguration.legalBusinessName = legalBusinessName;
    business.paymentConfiguration.businessType = businessType;
    business.paymentConfiguration.onlinePaymentStatus = ["activated", "active"].includes(account.status) ? "ACTIVE" : "PENDING_VERIFICATION";
    business.paymentConfiguration.lastVerificationUpdate = new Date();
    await business.save();
    return { status: business.paymentConfiguration.onlinePaymentStatus, accountId: account.id };
  }

  const phone = business.phone || ownerUser.phone;
  if (!phone) throw new ApiError(400, "A real contact phone is required for payment account onboarding");
  let account;
  try {
    account = await rzp.accounts.create({
      type: "route", name: legalBusinessName, email: business.email || ownerUser.email,
      phone, legal_business_name: legalBusinessName, business_type: businessType,
      contact_name: ownerUser.name, notes: { businessId: String(business._id), platform: "serveQ" },
    });
  } catch {
    throw new ApiError(502, "Razorpay could not create the linked account. Check its configuration before retrying.");
  }
  if (!account || typeof account.id !== "string" || !/^acc_[A-Za-z0-9]+$/.test(account.id)) throw new ApiError(502, "Razorpay did not return a valid linked account");
  business.paymentConfiguration.providerAccountReference = account.id;
  business.paymentConfiguration.legalBusinessName = legalBusinessName;
  business.paymentConfiguration.businessType = businessType;
  business.paymentConfiguration.onlinePaymentStatus = ["activated", "active"].includes(account.status) ? "ACTIVE" : "PENDING_VERIFICATION";
  business.paymentConfiguration.lastVerificationUpdate = new Date();
  await business.save();
  return { status: business.paymentConfiguration.onlinePaymentStatus, accountId: account.id };
};

// Coalesce concurrent retries; only remember events after successful processing.
const processedWebhookEvents = new Set();
const inFlightWebhookEvents = new Map();

const applyWebhookEvent = async (event, io, eventId) => {
  const eventType = event.event;
  if (!["payment.captured", "order.paid", "payment.failed", "refund.processed"].includes(eventType)) return { status: "ignored_event", eventId };
  const payment = event.payload?.payment?.entity;
  const order = event.payload?.order?.entity;
  const refund = event.payload?.refund?.entity;
  const orderId = payment?.order_id || order?.id;
  const booking = eventType === "refund.processed"
    ? (refund?.payment_id ? await Booking.findOne({ razorpayPaymentId: refund.payment_id }) : null)
    : (orderId ? await Booking.findOne({ razorpayOrderId: orderId }) : null);
  if (!booking) return { status: "no_matching_booking", orderId };

  const expectedAmount = bookingPaymentAmount(booking);
  const currency = booking.currency || "INR";
  if (eventType !== "refund.processed") {
    if (!booking.razorpayOrderId || booking.razorpayOrderId !== orderId || orderId.startsWith("order_mock_")) throw new ApiError(400, "Webhook order does not match booking");
    const notedBooking = payment?.notes?.bookingId || order?.notes?.bookingId;
    if (notedBooking && String(notedBooking) !== String(booking._id)) throw new ApiError(400, "Webhook booking reference does not match order");
  }

  if (eventType === "payment.captured" || eventType === "order.paid") {
    if (eventType === "payment.captured") {
      if (!payment || typeof payment.id !== "string" || !payment.id.startsWith("pay_") || payment.id.startsWith("pay_mock_") || payment.status !== "captured" || payment.amount !== expectedAmount || payment.currency !== currency) throw new ApiError(400, "Webhook payment does not match booking amount or capture status");
    } else if (!order || order.status !== "paid" || order.amount !== expectedAmount || order.amount_paid !== expectedAmount || order.currency !== currency) {
      throw new ApiError(400, "Webhook order is not fully paid for this booking");
    }
    if (["cancelled", "refunded"].includes(booking.status) || ["refunded", "partially_refunded"].includes(booking.paymentStatus)) return { status: "ignored_terminal_booking", eventId };
    if (booking.paymentStatus === "paid" && payment?.id && booking.razorpayPaymentId && booking.razorpayPaymentId !== payment.id) throw new ApiError(409, "Booking was paid with another payment");
    if (booking.paymentStatus !== "paid" || (payment?.id && !booking.razorpayPaymentId)) {
      booking.paymentStatus = "paid";
      if (["pending_payment", "scheduled"].includes(booking.status)) booking.status = "confirmed";
      booking.paidAmount = expectedAmount / 100;
      booking.paymentMethod = "online";
      if (payment?.id) booking.razorpayPaymentId = payment.id;
      booking.paidAt = new Date();
      await booking.save();
      io?.to(`business:${booking.businessId}`).emit("bookings:updated");
      io?.to(`user:${booking.userId}`).emit("booking:confirmed", { booking });
    }
  } else if (eventType === "payment.failed") {
    if (!["paid", "refunded", "partially_refunded"].includes(booking.paymentStatus)) {
      booking.paymentStatus = "failed";
      booking.paymentFailureReason = payment?.error_description || "Payment failed at gateway";
      await booking.save();
      io?.to(`user:${booking.userId}`).emit("payment:failed", { bookingId: booking._id, reason: booking.paymentFailureReason });
    }
  } else if (eventType === "refund.processed") {
    if (typeof refund.id !== "string" || !/^rfnd_[A-Za-z0-9]+$/.test(refund.id) || refund.payment_id !== booking.razorpayPaymentId || refund.status !== "processed" || refund.currency !== currency || !Number.isSafeInteger(refund.amount) || refund.amount <= 0 || refund.amount > expectedAmount) throw new ApiError(400, "Webhook refund does not match the paid booking");
    if (booking.refundReference !== refund.id && booking.paymentStatus !== "refunded") {
      booking.paymentStatus = refund.amount === expectedAmount ? "refunded" : "partially_refunded";
      if (booking.paymentStatus === "refunded") booking.status = "refunded";
      booking.refundedAt = new Date();
      booking.refundReference = refund.id;
      await booking.save();
      io?.to(`business:${booking.businessId}`).emit("bookings:updated");
    }
  }
  return { status: "processed", eventType, bookingId: booking._id };
};

export const processWebhookEvent = async (event, io = null) => {
  if (!event || typeof event.event !== "string") throw new ApiError(400, "Invalid webhook event payload");
  // Timestamps are not unique event IDs; distinct captures can share a second.
  const eventId = crypto.createHash("sha256").update(JSON.stringify(event)).digest("hex");
  if (processedWebhookEvents.has(eventId)) return { status: "ignored_duplicate", eventId };
  if (inFlightWebhookEvents.has(eventId)) return inFlightWebhookEvents.get(eventId);
  const work = applyWebhookEvent(event, io, eventId);
  inFlightWebhookEvents.set(eventId, work);
  try {
    const result = await work;
    if (result.status !== "no_matching_booking") {
      if (processedWebhookEvents.size > 5000) processedWebhookEvents.clear();
      processedWebhookEvents.add(eventId);
    }
    return result;
  } finally {
    inFlightWebhookEvents.delete(eventId);
  }
};
