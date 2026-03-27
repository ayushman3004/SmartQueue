import { Router } from "express";
import { create, getAll, getOne, getMine, update, toggle } from "./business.controller.js";
import { protect, allowRoles } from "../../../middleware/auth.middleware.js";

const router = Router();

// Public
router.get("/", getAll);

// Owner only — must be before /:id to prevent "mine" matching as an id
router.get("/mine", protect, allowRoles("owner"), getMine);
router.post("/", protect, allowRoles("owner"), create);
router.put("/:id", protect, allowRoles("owner"), update);
router.patch("/:id/toggle", protect, allowRoles("owner"), toggle);

// Public — single business (after /mine)
router.get("/:id", getOne);

export default router;
