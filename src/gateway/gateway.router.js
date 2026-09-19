import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import businessRoutes from "../modules/business/business.routes.js";
import bookingRoutes from "../booking/booking.routes.js";
import queueRoutes from "../queue/queue.routes.js";
import walletRoutes from "../modules/wallet/wallet.routes.js";
import reviewRoutes from "../modules/review/review.routes.js";
import couponRoutes from "../modules/coupon/coupon.routes.js";
import analyticsRoutes from "../modules/analytics/analytics.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import chatRoutes from "../modules/chat/chat.routes.js";
import chatbotRoutes from "../modules/chatbot/chatbot.routes.js";
import otpRoutes from "../modules/auth/otp.routes.js";

import { globalLimiter, authLimiter } from "./rateLimiter.js";
import { requestIdMiddleware } from "./gateway.middleware.js";

/**
 * Service Registry Configuration
 * Prepared for future decoupled microservices / reverse proxy extraction.
 */
export const serviceRegistry = {
  auth: {
    name: "auth-service",
    url: process.env.AUTH_SERVICE_URL || "internal",
    healthy: true,
  },
  business: {
    name: "business-service",
    url: process.env.BUSINESS_SERVICE_URL || "internal",
    healthy: true,
  },
  booking: {
    name: "booking-service",
    url: process.env.BOOKING_SERVICE_URL || "internal",
    healthy: true,
  },
  queue: {
    name: "queue-service",
    url: process.env.QUEUE_SERVICE_URL || "internal",
    healthy: true,
  },
  payment: {
    name: "payment-service",
    url: process.env.PAYMENT_SERVICE_URL || "internal",
    healthy: true,
  },
  analytics: {
    name: "analytics-service",
    url: process.env.ANALYTICS_SERVICE_URL || "internal",
    healthy: true,
  },
  notification: {
    name: "notification-service",
    url: process.env.NOTIFICATION_SERVICE_URL || "internal",
    healthy: true,
  },
};

export const createGatewayRouter = () => {
  const router = Router();

  // Gateway base middleware
  router.use(requestIdMiddleware);
  router.use(globalLimiter);

  // Health check endpoint
  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      architecture: "modular-monolith",
      gateway: "active",
      services: Object.keys(serviceRegistry).reduce((acc, key) => {
        acc[key] = serviceRegistry[key].healthy ? "up" : "down";
        return acc;
      }, {}),
    });
  });

  // Domain Routes Registration
  router.use("/auth", authLimiter, authRoutes);
  router.use("/businesses", businessRoutes);
  router.use("/bookings", bookingRoutes);
  router.use("/queue", queueRoutes);
  router.use("/wallet", walletRoutes);
  router.use("/payments", walletRoutes); // Alias for payment/wallet domain
  router.use("/reviews", reviewRoutes);
  router.use("/coupons", couponRoutes);
  router.use("/analytics", analyticsRoutes);
  router.use("/admin", adminRoutes);
  router.use("/chat", chatRoutes);
  router.use("/chatbot", chatbotRoutes);
  router.use("/otp", otpRoutes);

  return router;
};

export default createGatewayRouter;
