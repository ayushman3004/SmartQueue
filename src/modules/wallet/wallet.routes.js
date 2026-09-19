import { Router } from "express";
import {
  getBalance,
  addMoney,
  deductMoney,
  createDepositOrder,
  verifyDeposit,
} from "./wallet.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";

const router = Router();

router.use(protect);

router.get("/balance", getBalance);
router.post("/add", addMoney);
router.post("/deduct", deductMoney);
router.post("/order", createDepositOrder);
router.post("/verify", verifyDeposit);

export default router;
