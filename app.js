import express from "express";
import cors from "cors";
import passport from "passport";
import cookieParser from "cookie-parser";

// API Gateway router & error handler
import createGatewayRouter from "./src/gateway/gateway.router.js";
import { gatewayErrorHandler } from "./src/gateway/gateway.middleware.js";

// Passport config
import "./src/modules/Oauth/passport.config.js";

const app = express();

// ─── Trust Proxy (Required for reverse proxy, HTTPS detection & client IP) ──
app.set("trust proxy", 1);

// ─── CORS Configuration ──────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://serveq.tech",
  "https://www.serveq.tech",
  "https://smart-queue-blond.vercel.app",
  "https://smart-queue-git-main-ayushman3004s-projects.vercel.app",
  "https://smartqueue-p629.onrender.com",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".onrender.com");

      if (isAllowed) {
        return callback(null, true);
      }

      console.warn(`🚫 CORS rejected origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// ─── API Gateway Boundary ─────────────────────────────────────────
// All domain routes and gateway middleware are encapsulated here:
app.use("/api", createGatewayRouter());

// ─── Centralized Gateway Error Handler ─────────────────────────────
app.use(gatewayErrorHandler);

export default app;
