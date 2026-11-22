import { Router } from "express";
import {
  getPaymentConfig,
  createOrder,
  verifyPayment,
  handleWebhook,
  connectRouteAccount,
  getBusinessPaymentStatus,
  updatePaymentModes,
} from "./payment.controller.js";
import { protect, allowRoles } from "../../../middleware/auth.middleware.js";
import { paymentOrderLimit, paymentSettingsLimit } from "../../gateway/endpointRateLimits.js";

const router = Router();

// Public payment configuration for frontend Razorpay checkout modal
router.get("/config", getPaymentConfig);
router.post("/webhook", handleWebhook);

// Customer endpoints (Require authentication)
router.post("/create-order", protect, paymentOrderLimit, createOrder);
router.post("/verify", protect, verifyPayment);

// Business Owner & Admin endpoints (Payment setup & settings)
router.get("/business/:businessId/status", protect, getBusinessPaymentStatus);
router.post("/business/:businessId/connect-route", protect, allowRoles("owner", "admin"), paymentSettingsLimit, connectRouteAccount);
router.put("/business/:businessId/modes", protect, allowRoles("owner", "admin"), paymentSettingsLimit, updatePaymentModes);

export default router;
