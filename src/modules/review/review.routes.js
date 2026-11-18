import { Router } from "express";
import { create, update, getByBusiness, getMine } from "./review.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";

const router = Router();

// Public: view reviews for a business
router.get("/business/:businessId", getByBusiness);

// Authenticated: submit and view own reviews
router.post("/", protect, create);
router.get("/mine", protect, getMine);
router.patch("/:id", protect, update);

export default router;
