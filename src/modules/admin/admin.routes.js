import express from "express";
import * as adminController from "./admin.controller.js";
import { protect, allowRoles } from "../../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

router.get("/stats", adminController.getStats);
router.get("/businesses", adminController.getAllBusinesses);
router.get("/users", adminController.getAllUsers);
router.get("/business/:id", adminController.getBusinessDetail);
router.patch("/business/:id/moderate", adminController.moderateBusiness);
router.patch("/business/:id/toggle", adminController.toggleBusinessStatus);
router.delete("/business/:id", adminController.deleteBusiness);
router.get("/prelaunch-customers", adminController.getPrelaunchCustomers);
router.delete("/prelaunch-customers/:id", adminController.deletePrelaunchCustomer);

export default router;
