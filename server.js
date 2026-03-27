import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initSocket } from "./realtime/socket.js";

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, true), // Allow everything while satisfying credentials: true
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"], // Force websocket to avoid proxy polling issues
});

// Attach io to app so controllers can access it
app.set("io", io);

initSocket(io);

connectDB().then(() => {
  httpServer.listen(PORT, "0.0.0.0", async () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.IO ready`);
    console.log(`📦 MongoDB connected\n`);

    // Global Queue Background Task (Auto-completion loginc)
    const { getQueue } = await import("./src/queue/queue.service.js");
    const Business = (await import("./src/modules/business/business.model.js")).default;
    
    setInterval(async () => {
      try {
        const businesses = await Business.find({ isOpen: true }, "_id");
        for (const b of businesses) {
          // Pass io to trigger socket updates on auto-remove
          await getQueue(b._id, io);
        }
      } catch (err) {
        console.error("❌ background cleanup error:", err.message);
      }
    }, 30000); // every 30 seconds
  });
});
