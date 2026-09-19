import { Router } from "express";
import { validate, getAvailable, create } from "./coupon.controller.js";
import { protect, allowRoles } from "../../../middleware/auth.middleware.js";

const router = Router();

router.use(protect);

router.post("/validate", validate);
router.get("/available", getAvailable);
router.post("/", allowRoles("owner", "admin"), create);

export default router;
