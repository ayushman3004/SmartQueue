import { Router } from "express";
import { create, getByBusiness, getMine } from "./review.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";

const router = Router();

// Public: view reviews for a business
router.get("/business/:businessId", getByBusiness);

// Authenticated: submit and view own reviews
router.post("/", protect, create);
router.get("/mine", protect, getMine);

export default router;
