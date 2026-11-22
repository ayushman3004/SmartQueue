import "dotenv/config";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initSocket } from "./realtime/socket.js";
import { allowedOrigins, isOriginAllowed } from "./config/cors.js";
import { startBookingCompletionWorker } from "./src/booking/booking.completion.js";
import { cloudflareOriginGuard } from "./middleware/cloudflare-origin.middleware.js";
import { configureRateLimitStore } from "./src/gateway/rateLimitStore.js";

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer(app);
const rateLimitStore = configureRateLimitStore(app);
httpServer.on("close", () => rateLimitStore?.close());

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

connectDB().then(() => {
  const stopBookingCompletion = startBookingCompletionWorker(io);
  httpServer.on("close", stopBookingCompletion);
  httpServer.listen(PORT, "0.0.0.0", async () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔌 Socket.IO ready`);
    console.log(`📦 MongoDB connected\n`);
  });
});
