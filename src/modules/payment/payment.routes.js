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

const router = Router();

// Public payment configuration for frontend Razorpay checkout modal
router.get("/config", getPaymentConfig);

// Webhook endpoint (Raw body signature verification handled in controller)
router.post("/webhook", handleWebhook);

// Customer endpoints (Require authentication)
router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyPayment);

// Business Owner & Admin endpoints (Payment setup & settings)
router.get("/business/:businessId/status", protect, getBusinessPaymentStatus);
router.post("/business/:businessId/connect-route", protect, allowRoles("owner", "admin"), connectRouteAccount);
router.put("/business/:businessId/modes", protect, allowRoles("owner", "admin"), updatePaymentModes);

export default router;
