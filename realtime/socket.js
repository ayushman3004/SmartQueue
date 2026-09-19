import jwt from "jsonwebtoken";
import { getQueue } from "../src/queue/queue.service.js";
import Business from "../src/modules/business/business.model.js";

/**
 * Socket.IO authentication and authorization initialization
 */
export const initSocket = (io) => {
  // ─── Socket Authentication Middleware ─────────────────────────
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(" ");
        if (parts.length === 2 && parts[0] === "Bearer") {
          token = parts[1];
        }
      }

      if (!token && socket.handshake.headers?.cookie) {
        const cookieMatch = socket.handshake.headers.cookie
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("token="));
        if (cookieMatch) {
          token = cookieMatch.split("=")[1];
        }
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.user = {
            _id: decoded.id,
            id: decoded.id,
            role: decoded.role,
          };
        } catch (err) {
          console.warn(`⚠️ Socket authentication token invalid: ${err.message}`);
          socket.user = null;
        }
      } else {
        socket.user = null; // Guest connection
      }

      next();
    } catch (err) {
      next(err);
    }
  });

  // 🕒 Auto-cleanup for active rooms every 30 seconds
  setInterval(async () => {
    const rooms = Array.from(io.sockets.adapter.rooms.keys())
      .filter((r) => r.startsWith("business:") && !r.endsWith(":admin"));

    for (const room of rooms) {
      const businessId = room.split(":")[1];
      try {
        await getQueue(businessId, io);
      } catch {
        // Silently continue if business not active
      }
    }
  }, 30000);

  io.on("connection", (socket) => {
    // Join a public business-specific room to receive queue updates
    socket.on("join:room", ({ businessId }) => {
      if (businessId) {
        socket.join(`business:${businessId}`);
      }
    });

    // Special administrative room for owners (includes customer names and details)
    socket.on("join:admin", async ({ businessId }) => {
      if (!businessId) return;

      if (!socket.user) {
        socket.emit("error", { message: "Authentication required to join admin room" });
        return;
      }

      try {
        if (socket.user.role === "admin") {
          socket.join(`business:${businessId}:admin`);
          return;
        }

        const business = await Business.findById(businessId);
        if (business && business.owner.toString() === socket.user.id.toString()) {
          socket.join(`business:${businessId}:admin`);
        } else {
          socket.emit("error", { message: "Unauthorized: not the owner of this business" });
        }
      } catch {
        socket.emit("error", { message: "Authorization check failed" });
      }
    });

    // Private room for targeted user notifications & wallet updates
    socket.on("join:user", ({ userId }) => {
      if (!userId) return;

      if (!socket.user) {
        socket.emit("error", { message: "Authentication required for private user updates" });
        return;
      }

      // Restrict users to only their own private room
      if (socket.user.id.toString() !== userId.toString() && socket.user.role !== "admin") {
        socket.emit("error", { message: "Access denied to foreign user notifications" });
        return;
      }

      socket.join(`user:${userId}`);
    });

    // Booking-specific chat room
    socket.on("join:booking", ({ bookingId }) => {
      if (bookingId && socket.user) {
        socket.join(`booking:${bookingId}`);
      }
    });

    // Leave rooms
    socket.on("leave:room", ({ businessId, userId, bookingId }) => {
      if (businessId) {
        socket.leave(`business:${businessId}`);
        socket.leave(`business:${businessId}:admin`);
      }
      if (userId) {
        socket.leave(`user:${userId}`);
      }
      if (bookingId) {
        socket.leave(`booking:${bookingId}`);
      }
    });

    socket.on("disconnect", () => {});
  });
};
