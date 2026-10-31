import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initSocket } from "./realtime/socket.js";
import { allowedOrigins, isOriginAllowed } from "./config/cors.js";

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer(app);

// Export for use in app.js / route handlers
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
