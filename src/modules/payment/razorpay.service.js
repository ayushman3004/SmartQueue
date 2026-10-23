import crypto from "crypto";
import Razorpay from "razorpay";
import Booking from "../../booking/booking.model.js";
import Business from "../business/business.model.js";
import ApiError from "../../../utils/ApiError.js";

// Razorpay client singleton
let razorpayClient = null;

export const getRazorpayClient = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    return null;
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id,
      key_secret,
    });
  }

  return razorpayClient;
};

export const isRazorpayConfigured = () => {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
};

export const getPublicPaymentConfig = () => {
  return {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    isConfigured: isRazorpayConfigured(),
    currency: "INR",
    isTestMode: !process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_"),
  };
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
  const secret = secretOverride || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    // If running in development without credentials, allow mock signatures
    if (razorpayOrderId?.startsWith("order_mock_") || razorpayPaymentId?.startsWith("pay_mock_")) {
      return true;
    }
    throw new ApiError(500, "Razorpay secret key is not configured on server");
  }

  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const generatedBuf = Buffer.from(generatedSignature);
  const signatureBuf = Buffer.from(razorpaySignature || "");

  if (generatedBuf.length !== signatureBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(generatedBuf, signatureBuf);
};

/**
 * Verifies Razorpay webhook signature using raw payload buffer
 */
export const verifyWebhookSignature = (rawBody, signature, secretOverride = null) => {
  const secret = secretOverride || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new ApiError(500, "Razorpay webhook secret is not configured");
  }

  if (!rawBody || !signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedSignature);
  const signatureBuf = Buffer.from(signature);

  if (expectedBuf.length !== signatureBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
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

  // If Razorpay credentials are not yet configured on server, generate verifiable mock order
  if (!rzp) {
    const mockOrderId = `order_mock_${crypto.randomBytes(8).toString("hex")}`;
    booking.razorpayOrderId = mockOrderId;
    booking.paymentMethod = "online";
    booking.paymentStatus = "pending";
    await booking.save();

    return {
      id: mockOrderId,
      amount: amountInPaise,
      currency: "INR",
      keyId: "rzp_test_mock_key",
      isMock: true,
      businessName: business.name,
      notes: { bookingId: booking._id.toString() },
    };
  }

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

    booking.razorpayOrderId = order.id;
    booking.paymentMethod = "online";
    booking.paymentStatus = "pending";
    booking.amount = amountInRupees;
    await booking.save();

    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      businessName: business.name,
      notes: order.notes,
    };
  } catch (err) {
    console.error("Razorpay order creation error:", err);
    // If Route capability is not yet enabled on the main Razorpay account, report clear diagnostic
    if (err.error?.description?.includes("transfers") || err.error?.code === "BAD_REQUEST_ERROR") {
      throw new ApiError(
        400,
        `Razorpay Route error: ${err.error?.description || "Linked account transfers not enabled for platform account."}`
      );
    }
    throw new ApiError(500, err.error?.description || "Failed to create payment order with Razorpay");
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
  const providedAccountId = payload.accountId?.trim();

  // If the owner has provided an existing approved Razorpay Account ID (acc_...)
  if (providedAccountId && providedAccountId.startsWith("acc_")) {
    business.paymentConfiguration.providerAccountReference = providedAccountId;
    business.paymentConfiguration.legalBusinessName = legalBusinessName;
    business.paymentConfiguration.businessType = businessType;
    business.paymentConfiguration.onlinePaymentStatus = "ACTIVE";
    business.paymentConfiguration.lastVerificationUpdate = new Date();
    await business.save();

    return {
      status: "ACTIVE",
      accountId: providedAccountId,
      message: "Razorpay linked account associated successfully",
    };
  }

  const rzp = getRazorpayClient();

  if (!rzp) {
    // Test mode / Mock fallback
    const mockAccountId = `acc_mock_${crypto.randomBytes(6).toString("hex")}`;
    business.paymentConfiguration.providerAccountReference = mockAccountId;
    business.paymentConfiguration.legalBusinessName = legalBusinessName;
    business.paymentConfiguration.businessType = businessType;
    business.paymentConfiguration.onlinePaymentStatus = "ACTIVE";
    business.paymentConfiguration.lastVerificationUpdate = new Date();
    await business.save();

    return {
      status: "ACTIVE",
      accountId: mockAccountId,
      isMock: true,
      message: "Test mode linked account connected",
    };
  }

  // Attempt standard Razorpay Accounts API call (Route Linked Account)
  try {
    // Razorpay V2 Accounts API
    const accountPayload = {
      type: "route",
      name: legalBusinessName,
      email: business.email || ownerUser.email,
      phone: business.phone || ownerUser.phone || "9999999999",
      legal_business_name: legalBusinessName,
      business_type: businessType,
      contact_name: ownerUser.name,
      notes: {
        businessId: business._id.toString(),
        platform: "serveQ",
      },
    };

    // Use official razorpay instance or direct HTTP request to /v2/accounts
    let account = null;
    try {
      account = await rzp.accounts.create(accountPayload);
    } catch (routeErr) {
      console.warn("Direct Razorpay accounts.create error:", routeErr?.message || routeErr);
      // If accounts API requires partner OAuth or hosted onboarding link
      business.paymentConfiguration.onlinePaymentStatus = "PENDING_VERIFICATION";
      business.paymentConfiguration.legalBusinessName = legalBusinessName;
      business.paymentConfiguration.businessType = businessType;
      business.paymentConfiguration.accountRequirements = [
        "Razorpay Route linked account activation required on platform dashboard.",
      ];
      await business.save();

      return {
        status: "PENDING_VERIFICATION",
        accountId: business.paymentConfiguration.providerAccountReference || "",
        message: "Account connection initiated. Razorpay Route approval pending on platform account.",
      };
    }

    if (account && account.id) {
      business.paymentConfiguration.providerAccountReference = account.id;
      business.paymentConfiguration.legalBusinessName = legalBusinessName;
      business.paymentConfiguration.businessType = businessType;
      business.paymentConfiguration.onlinePaymentStatus =
        account.status === "activated" || account.status === "active" ? "ACTIVE" : "PENDING_VERIFICATION";
      business.paymentConfiguration.lastVerificationUpdate = new Date();
      await business.save();

      return {
        status: business.paymentConfiguration.onlinePaymentStatus,
        accountId: account.id,
        account,
      };
    }
  } catch (err) {
    console.error("connectRazorpayRouteAccount error:", err);
    business.paymentConfiguration.onlinePaymentStatus = "PENDING_VERIFICATION";
    await business.save();

    return {
      status: "PENDING_VERIFICATION",
      message: err.message || "Route onboarding pending provider approval",
    };
  }

  return {
    status: business.paymentConfiguration.onlinePaymentStatus,
    accountId: business.paymentConfiguration.providerAccountReference,
  };
};

// In-memory set to ensure idempotent webhook event handling
const processedWebhookEvents = new Set();

/**
 * Idempotently handles verified Razorpay webhook events
 */
export const processWebhookEvent = async (event, io = null) => {
  if (!event || !event.event) {
    throw new ApiError(400, "Invalid webhook event payload");
  }

  const eventId = event.id || event.created_at || JSON.stringify(event.payload);
  if (processedWebhookEvents.has(eventId)) {
    return { status: "ignored_duplicate", eventId };
  }

  // Cap the set size to prevent memory leaks
  if (processedWebhookEvents.size > 5000) {
    processedWebhookEvents.clear();
  }
  processedWebhookEvents.add(eventId);

  const eventType = event.event;
  const paymentEntity = event.payload?.payment?.entity;
  const orderEntity = event.payload?.order?.entity;

  const orderId = paymentEntity?.order_id || orderEntity?.id;
  const bookingId = paymentEntity?.notes?.bookingId || orderEntity?.notes?.bookingId;

  let booking = null;
  if (bookingId) {
    booking = await Booking.findById(bookingId);
  } else if (orderId) {
    booking = await Booking.findOne({ razorpayOrderId: orderId });
  }

  if (!booking) {
    return { status: "no_matching_booking", orderId };
  }

  switch (eventType) {
    case "payment.captured":
    case "order.paid": {
      if (booking.paymentStatus !== "paid") {
        booking.paymentStatus = "paid";
        booking.status = "confirmed";
        booking.paidAmount = paymentEntity?.amount ? paymentEntity.amount / 100 : booking.amount;
        booking.razorpayPaymentId = paymentEntity?.id || booking.razorpayPaymentId;
        booking.paidAt = new Date();
        await booking.save();

        if (io) {
          io.to(`business:${booking.businessId}`).emit("bookings:updated");
          io.to(`user:${booking.userId}`).emit("booking:confirmed", { booking });
        }
      }
      break;
    }

    case "payment.failed": {
      if (booking.paymentStatus !== "paid") {
        booking.paymentStatus = "failed";
        booking.paymentFailureReason = paymentEntity?.error_description || "Payment failed at gateway";
        await booking.save();

        if (io) {
          io.to(`user:${booking.userId}`).emit("payment:failed", {
            bookingId: booking._id,
            reason: booking.paymentFailureReason,
          });
        }
      }
      break;
    }

    case "refund.processed": {
      booking.paymentStatus = "refunded";
      booking.status = "refunded";
      booking.refundedAt = new Date();
      booking.refundReference = event.payload?.refund?.entity?.id || "";
      await booking.save();

      if (io) {
        io.to(`business:${booking.businessId}`).emit("bookings:updated");
      }
      break;
    }

    default:
      break;
  }

  return { status: "processed", eventType, bookingId: booking._id };
};
