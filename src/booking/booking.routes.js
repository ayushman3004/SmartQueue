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
  collectPayment,
} from "./booking.controller.js";
import { protect, allowRoles } from "../../middleware/auth.middleware.js";

const router = Router();

// User routes
router.get("/mine", protect, myBookings);
router.post("/", protect, allowRoles("customer", "admin"), book);
router.patch("/:id/cancel", protect, cancel);
router.post("/:id/respond", protect, allowRoles("customer", "admin"), respondDelay);

// Slots — authenticated users
router.get("/slots/:businessId", protect, getSlots);

// Owner routes
router.get("/:businessId/all", protect, allowRoles("owner", "admin"), businessBookings);
router.post("/extend/:id", protect, allowRoles("admin"), extend);
router.patch("/:id/start", protect, allowRoles("admin"), startService);
router.patch("/:id/complete", protect, allowRoles("admin"), completeService);
router.patch("/:id/collect-payment", protect, allowRoles("admin"), collectPayment);

export default router;
