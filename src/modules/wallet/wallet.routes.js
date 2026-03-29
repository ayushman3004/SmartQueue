import express from "express";
import * as walletController from "./wallet.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/balance", walletController.getBalance);
router.post("/add", walletController.addMoney);
router.post("/deduct", walletController.deductMoney);

export default router;
