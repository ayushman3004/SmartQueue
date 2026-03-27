import { Router } from "express";
import {
  book,
  getSlots,
  extend,
  respondDelay,
  startService,
  completeService,
  myBookings,
  businessBookings,
  cancel,
} from "./booking.controller.js";
import { protect, allowRoles } from "../../middleware/auth.middleware.js";

const router = Router();

// User routes
router.get("/mine", protect, myBookings);
router.post("/", protect, allowRoles("user"), book);
router.patch("/:id/cancel", protect, cancel);
router.post("/:id/respond", protect, allowRoles("user"), respondDelay);

// Slots — authenticated users
router.get("/slots/:businessId", protect, getSlots);

// Owner routes
router.get("/:businessId/all", protect, allowRoles("owner"), businessBookings);
router.post("/extend/:id", protect, allowRoles("owner"), extend);
router.patch("/:id/start", protect, allowRoles("owner"), startService);
router.patch("/:id/complete", protect, allowRoles("owner"), completeService);

export default router;
