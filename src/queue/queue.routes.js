import { Router } from "express";
import { getQueue, join, leave, callNext, estimate, extend } from "./queue.controller.js";
import { protect, allowRoles } from "../../middleware/auth.middleware.js";

const router = Router();

// ⚠️ IMPORTANT: /estimate MUST be before /:businessId to prevent param capture
router.get("/estimate/:businessId", protect, estimate);

// Public — anyone can view a queue
router.get("/:businessId", getQueue);

// User only — join & leave
router.post("/:businessId/join", protect, allowRoles("user"), join);
router.delete("/:businessId/leave", protect, allowRoles("user"), leave);

// Owner only — call next customer
// Owner only — management
router.post("/:businessId/next", protect, allowRoles("owner"), callNext);
router.post("/:businessId/extend", protect, allowRoles("owner"), extend);

export default router;
