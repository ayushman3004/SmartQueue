import { Router } from "express";
import {
  getBasicHealth,
  getLiveness,
  getReadiness,
  getDetailedHealth,
} from "./health.controller.js";

const router = Router();

// Basic health check (compatible with uptime monitors & load balancers)
router.get("/", getBasicHealth);

// Liveness probe (verifies process responsiveness)
router.get("/live", getLiveness);

// Readiness probe (verifies database and dependent service connectivity)
router.get("/ready", getReadiness);

// Detailed diagnostic (includes architecture, service registry status, memory & environment)
router.get("/detailed", getDetailedHealth);

export { getBasicHealth, getLiveness, getReadiness, getDetailedHealth };
export default router;
