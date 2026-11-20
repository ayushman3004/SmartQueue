import User from "../auth/auth.model.js";
import { canAccessOwnerCategory } from "../../utils/ownerCategory.js";
import { isBusinessSubscriptionActive } from "../subscription/subscription.service.js";
import Business from "./business.model.js";
import { Router } from "express";
import {
  create,
  selectCategory,
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

router.get("/owner-category", protect, allowRoles("owner", "admin"), (req, res) => {
  res.json({ success: true, data: { categories: req.user.businessCategories || [] } });
});
router.post("/owner-category", protect, allowRoles("owner"), requireVerifiedEmail, async (req, res, next) => {
  try {
    const { category } = req.body;
    if (!["clinic", "salon"].includes(category)) return res.status(400).json({ message: "Choose clinic or salon." });
    if (!await isBusinessSubscriptionActive({ _id: req.user.subscription?.businessId, owner: req.user._id })) return res.status(403).json({ message: "Complete payment before choosing your business category." });
    const updated = await User.findOneAndUpdate(
      { _id: req.user._id, $or: [{ businessCategories: { $size: 0 } }, { businessCategories: { $exists: false } }] },
      { $set: { businessCategories: [category] } }, { new: true, runValidators: true }
    );
    if (!updated) return res.status(403).json({ message: "Ask the admin to change or add a business category." });
    res.json({ success: true, data: { categories: updated.businessCategories } });
  } catch (error) { next(error); }
});
router.put("/owner-category/:ownerId", protect, allowRoles("admin"), async (req, res, next) => {
  try {
    const categories = req.body.categories;
    if (!Array.isArray(categories) || !categories.length || categories.some(category => !["clinic", "salon"].includes(category))) return res.status(400).json({ message: "Provide clinic and/or salon categories." });
    const owner = await User.findOneAndUpdate({ _id: req.params.ownerId, role: "owner" }, { $set: { businessCategories: [...new Set(categories)] } }, { new: true, runValidators: true });
    if (!owner) return res.status(404).json({ message: "Owner not found." });
    res.json({ success: true, data: { categories: owner.businessCategories } });
  } catch (error) { next(error); }
});
router.get("/accessible", protect, allowRoles("owner", "admin"), async (req, res, next) => {
  try {
    const businesses = await Business.find({ owner: req.user._id });
    res.json({ success: true, data: { businesses: businesses.filter(b => canAccessOwnerCategory(req.user, b)) } });
  } catch (error) { next(error); }
});

// Owner only — must be before /:id to prevent "mine" or "onboarding" matching as an id
router.get("/mine", protect, allowRoles("owner", "admin"), getMine);
router.get("/onboarding/draft", protect, allowRoles("owner", "admin"), getOnboardingDraft);
router.post("/onboarding/init", protect, allowRoles("owner", "admin"), requireVerifiedEmail, initOnboarding);
router.put("/:id/onboarding/step", protect, allowRoles("owner", "admin"), requireVerifiedEmail, saveOnboardingStep);
router.post("/:id/onboarding/launch", protect, allowRoles("owner", "admin"), requireVerifiedEmail, launchBusiness);
router.post("/", protect, allowRoles("owner", "admin"), requireVerifiedEmail, create);
router.post("/:id/category", protect, allowRoles("owner", "admin"), requireVerifiedEmail, selectCategory);
router.put("/:id", protect, allowRoles("owner", "admin"), update);
router.patch("/:id/toggle", protect, allowRoles("owner", "admin"), toggle);

// Public — single business (after /mine)
router.get("/:id", getOne);

export default router;
