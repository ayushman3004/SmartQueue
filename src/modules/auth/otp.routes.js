import { Router } from "express";

const router = Router();

router.post(["/send", "/verify"], (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(410).json({
    success: false,
    message: "Sign in with email or Google, then verify your phone from Profile.",
  });
});

export default router;
