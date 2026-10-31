import express from "express";
import cors from "cors";
import passport from "passport";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import { corsOptions, allowedOrigins, isOriginAllowed } from "./config/cors.js";

// API Gateway router & error handler
import createGatewayRouter from "./src/gateway/gateway.router.js";
import { gatewayErrorHandler } from "./src/gateway/gateway.middleware.js";

// Health check routes & probes
import healthRoutes, {
  getLiveness,
  getReadiness,
} from "./src/modules/health/health.routes.js";

// Passport config
import "./src/modules/Oauth/passport.config.js";

const app = express();

// ─── Trust Proxy (Required for reverse proxy, HTTPS detection & client IP) ──
app.set("trust proxy", 1);

// ─── CORS Configuration ──────────────────────────────────────────
app.set("allowedOrigins", allowedOrigins);
app.set("isOriginAllowed", isOriginAllowed);
app.use(cors(corsOptions));

// ─── Health Check Endpoints (For Uptime Monitors, Probes & Load Balancers) ──
// Placed before express.json() & rate-limiters so monitoring probes are fast and never rate-limited
app.use(["/health", "/api/health", "/healthz"], healthRoutes);
app.get("/live", getLiveness);
app.get("/ready", getReadiness);


app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(cookieParser());
app.use(passport.initialize());

// ─── API Gateway Boundary ─────────────────────────────────────────
// All domain routes and gateway middleware are encapsulated here:
app.use("/api", createGatewayRouter());

// ─── Centralized Gateway Error Handler ─────────────────────────────
app.use(gatewayErrorHandler);

export default app;
