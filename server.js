/* global process */
import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initSocket } from "./realtime/socket.js";

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer(app);

// ─── Allowed Origins (single source of truth) ──────────────────
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

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow server-to-server / mobile / curl
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true;
  if (origin.endsWith(".onrender.com")) return true;
  return false;
};

// Export for use in app.js
app.set("allowedOrigins", allowedOrigins);
app.set("isOriginAllowed", isOriginAllowed);

const io = new Server(httpServer, {
  cors: {
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
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Attach io to app so controllers can access it
app.set("io", io);

initSocket(io);

connectDB().then(() => {
  httpServer.listen(PORT, "0.0.0.0", async () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔌 Socket.IO ready`);
    console.log(`📦 MongoDB connected\n`);
  });
});
