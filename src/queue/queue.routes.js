import { Router } from "express";
import { getQueue, join, leave, callNext, estimate, extend, cancelDelay, assignStaff, collectPayment, walkIn } from "./queue.controller.js";
import { protect, optionalAuth, allowRoles } from "../../middleware/auth.middleware.js";
import { walkInLimit } from '../gateway/endpointRateLimits.js';

const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

// ⚠️ IMPORTANT: /estimate MUST be before /:businessId to prevent param capture
router.get("/estimate/:businessId", protect, estimate);

// Public — anyone can view a queue
router.get("/:businessId", optionalAuth, getQueue);

// User only — join & leave
router.post("/:businessId/join", protect, allowRoles("customer", "admin"), join);
router.delete("/:businessId/leave", protect, allowRoles("customer", "admin"), leave);
router.post("/:businessId/cancel-delay", protect, allowRoles("customer", "admin"), cancelDelay);

// Owner only — management
router.post('/:businessId/walk-in', protect, allowRoles('owner', 'admin'), walkInLimit, walkIn);
router.post("/:businessId/next", protect, allowRoles("admin"), callNext);
router.post("/:businessId/extend", protect, allowRoles("admin"), extend);
router.post("/:businessId/assign-staff", protect, allowRoles("admin"), assignStaff);
router.post("/:businessId/users/:userId/collect-payment", protect, allowRoles("owner", "admin"), collectPayment);

export default router;

