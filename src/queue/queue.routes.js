import { Router } from "express";
import { getQueue, join, leave, callNext, estimate, extend, cancelDelay } from "./queue.controller.js";
import { protect, allowRoles } from "../../middleware/auth.middleware.js";

const router = Router();

// ⚠️ IMPORTANT: /estimate MUST be before /:businessId to prevent param capture
router.get("/estimate/:businessId", protect, estimate);

// Public — anyone can view a queue
router.get("/:businessId", getQueue);

// User only — join & leave
router.post("/:businessId/join", protect, allowRoles("customer", "admin"), join);
router.delete("/:businessId/leave", protect, allowRoles("customer", "admin"), leave);
router.post("/:businessId/cancel-delay", protect, allowRoles("customer", "admin"), cancelDelay);

// Owner only — management
router.post("/:businessId/next", protect, allowRoles("owner", "admin"), callNext);
router.post("/:businessId/extend", protect, allowRoles("owner", "admin"), extend);

export default router;
