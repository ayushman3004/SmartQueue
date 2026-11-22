import { Router } from "express";
import {
  getPlansHandler,
  createOrderHandler,
  verifyPaymentHandler,
  getCurrentSubscriptionHandler,
  redeemCouponHandler,
} from "./subscription.controller.js";
import { protect, allowRoles } from "../../../middleware/auth.middleware.js";
import { paymentOrderLimit } from "../../gateway/endpointRateLimits.js";

const router = Router();

// Public / Authenticated plans catalog
router.get("/plans", getPlansHandler);

// Authenticated Business Owner endpoints
router.get("/current", protect, getCurrentSubscriptionHandler);
router.post("/redeem-coupon", protect, allowRoles("owner"), redeemCouponHandler);
router.post("/create-order", protect, allowRoles("owner", "admin"), paymentOrderLimit, createOrderHandler);
router.post("/verify", protect, allowRoles("owner", "admin"), verifyPaymentHandler);

export default router;
