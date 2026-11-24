import "dotenv/config";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initSocket } from "./realtime/socket.js";
import { allowedOrigins, isOriginAllowed } from "./config/cors.js";
import { startFollowUpReminderWorker } from "./src/modules/doctor/follow-up-reminder.service.js";
import { startBookingCompletionWorker } from "./src/booking/booking.completion.js";
import { cloudflareOriginGuard } from "./middleware/cloudflare-origin.middleware.js";
import { configureRateLimitStore } from "./src/gateway/rateLimitStore.js";

import { configureWhatsApp, ensureWhatsAppIndexes } from "./src/modules/whatsapp/whatsapp.runtime.js";
import { startPrescriptionNotificationWorker } from "./src/modules/whatsapp/prescription-notifications.js";

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer(app);
const rateLimitStore = configureRateLimitStore(app);
const whatsapp = configureWhatsApp(app, rateLimitStore);

// Export for use in app.js / route handlers
app.set("allowedOrigins", allowedOrigins);
app.set("isOriginAllowed", isOriginAllowed);

const io = new Server(httpServer, {
  // CORS alone does not restrict WebSocket handshakes carrying session cookies.
  allowRequest: (req, callback) => callback(null, isOriginAllowed(req.headers.origin)),
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Engine.IO handles upgrades and polling outside the Express middleware stack.
io.engine.use(cloudflareOriginGuard);
io.engine.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 Socket.IO CORS rejected origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  credentials: true,
}));

// Attach io to app so controllers can access it
app.set("io", io);

initSocket(io);

connectDB().then(async () => {
  if (whatsapp) await ensureWhatsAppIndexes();
  const stopWhatsApp = whatsapp && startPrescriptionNotificationWorker(whatsapp);
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    try {
      await stopWhatsApp?.();
      await new Promise(resolve => io.close(resolve));
      rateLimitStore?.close();
      await mongoose.disconnect();
    } catch {
      console.error("Could not complete backend shutdown");
      process.exitCode = 1;
    }
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  const stopBookingCompletion = startBookingCompletionWorker(io);
  httpServer.on("close", stopBookingCompletion);
  httpServer.on("close", startFollowUpReminderWorker(io));
  httpServer.listen(PORT, "0.0.0.0", async () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔌 Socket.IO ready`);
    console.log(`📦 MongoDB connected\n`);
  });
}).catch(() => {
  console.error("Backend initialization failed");
  rateLimitStore?.close();
  void mongoose.disconnect().finally(() => { process.exitCode = 1; });
});
