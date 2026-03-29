import express from "express";
import * as adminController from "./admin.controller.js";
import { protect, allowRoles } from "../../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

router.get("/stats", adminController.getStats);
router.patch("/business/:id/toggle", adminController.toggleBusinessStatus);

export default router;
