import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initSocket } from "./realtime/socket.js";
import cors from 'cors';

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "https://smart-queue-blond.vercel.app",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"], // Allow both for better proxy compatibility
});

// Attach io to app so controllers can access it
app.set("io", io);

// app.options("/*", cors());

initSocket(io);

connectDB().then(() => {
  httpServer.listen(PORT, "0.0.0.0", async () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.IO ready`);
    console.log(`📦 MongoDB connected\n`);
  });
});
