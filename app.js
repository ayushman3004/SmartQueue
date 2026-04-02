import express from "express";
import cors from "cors";
import passport from "passport";
import cookieParser from "cookie-parser";

// Routes
import authRoutes from "./src/modules/auth/auth.routes.js";
import businessRoutes from "./src/modules/business/business.routes.js";
import queueRoutes from "./src/queue/queue.routes.js";
import bookingRoutes from "./src/booking/booking.routes.js";
import chatbotRoutes from "./src/modules/chatbot/chatbot.routes.js";
import walletRoutes from "./src/modules/wallet/wallet.routes.js";
import adminRoutes from "./src/modules/admin/admin.routes.js";
import chatRoutes from "./src/modules/chat/chat.routes.js";
import User from "./src/modules/auth/auth.model.js";

// Passport config
import "./src/modules/Oauth/passport.config.js";

const app = express();

// ─── Middleware ──────────────────────────────────────────────
const allowedOrigins = [
  "https://smart-queue-blond.vercel.app",
  "https://smart-queue-git-main-ayushman3004s-projects.vercel.app",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: "*"
}));

app.options("*", cors()); // 🔥 VERY IMPORTANT

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       // Allow requests with no origin (like mobile apps or curl)
//       if (!origin) return callback(null, true);
      
//       const isAllowed = allowedOrigins.some(allowedOrigin => {
//         if (allowedOrigin.includes('*')) {
//           const regex = new RegExp('^' + allowedOrigin.replace(/\*/g, '.*') + '$');
//           return regex.test(origin);
//         }
//         return allowedOrigin === origin;
//       });

//       if (isAllowed || origin.endsWith('.vercel.app')) {
//         callback(null, true);
//       } else {
//         callback(new Error('Not allowed by CORS'));
//       }
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
//     allowedHeaders: ["*"]
//   })
// );

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// ─── Routes ──────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);

// ─── Health Check ─────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── TEMP MIGRATION ──────────────────────────────────────────
app.get("/api/migrate", async (req, res) => {
  const result = await User.updateMany({ role: "user" }, { $set: { role: "customer" } });
  res.json({ success: true, modifiedCount: result.modifiedCount });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join(", ");
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for ${field}`;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") { statusCode = 401; message = "Invalid token"; }
  if (err.name === "TokenExpiredError") { statusCode = 401; message = "Token expired"; }

  // Log only server errors
  if (statusCode >= 500) console.error("🔥 Server Error:", err);

  res.status(statusCode).json({
    success: false,
    message,
  });
});

export default app;
