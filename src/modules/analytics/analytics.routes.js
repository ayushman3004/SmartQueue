import { Router } from "express";
import { getAnalytics } from "./analytics.controller.js";
import { protect, allowRoles } from "../../../middleware/auth.middleware.js";

const router = Router();

router.use(protect);
router.get("/:businessId", allowRoles("owner", "admin"), getAnalytics);

export default router;
