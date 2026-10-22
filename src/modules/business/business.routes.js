import { Router } from "express";
import {
  create,
  getAll,
  getOne,
  getMine,
  update,
  toggle,
  getOnboardingDraft,
  initOnboarding,
  saveOnboardingStep,
  launchBusiness,
} from "./business.controller.js";
import { protect, allowRoles, requireVerifiedEmail } from "../../../middleware/auth.middleware.js";

const router = Router();

// Public
router.get("/", getAll);

// Owner only — must be before /:id to prevent "mine" or "onboarding" matching as an id
router.get("/mine", protect, allowRoles("owner", "admin"), getMine);
router.get("/onboarding/draft", protect, allowRoles("owner", "admin"), getOnboardingDraft);
router.post("/onboarding/init", protect, allowRoles("owner", "admin"), requireVerifiedEmail, initOnboarding);
router.put("/:id/onboarding/step", protect, allowRoles("owner", "admin"), requireVerifiedEmail, saveOnboardingStep);
router.post("/:id/onboarding/launch", protect, allowRoles("owner", "admin"), requireVerifiedEmail, launchBusiness);
router.post("/", protect, allowRoles("owner", "admin"), requireVerifiedEmail, create);
router.put("/:id", protect, allowRoles("owner", "admin"), update);
router.patch("/:id/toggle", protect, allowRoles("owner", "admin"), toggle);

// Public — single business (after /mine)
router.get("/:id", getOne);

export default router;
