import Booking from "../src/booking/booking.model.js";
import User from "../src/modules/auth/auth.model.js";
import { ownerState } from "../src/modules/business-application/owner-lifecycle.js";
import jwt from "jsonwebtoken";
import { getQueue } from "../src/queue/queue.service.js";
import Business from "../src/modules/business/business.model.js";

// ─── Real-Time Presence Tracking ──────────────────────────────
export const onlineUsers = new Map(); // userId string -> Set of socketIds
export const onlineHubs = new Map();  // businessId string -> Set of socketIds
const socketSubscriptions = new Map(); // socketId -> { userIds: Set, hubIds: Set }

export const isUserOnline = (userId) => {
  if (!userId) return false;
  const sockets = onlineUsers.get(userId.toString());
  return Boolean(sockets && sockets.size > 0);
};

export const isHubOnline = (hubId, ownerId) => {
  if (hubId) {
    const hubSockets = onlineHubs.get(hubId.toString());
    if (hubSockets && hubSockets.size > 0) return true;
  }
  if (ownerId) {
    return isUserOnline(ownerId.toString());
  }
  return false;
};

export const getOnlineUserIds = () =>
  Array.from(onlineUsers.keys()).filter((id) => (onlineUsers.get(id)?.size || 0) > 0);

export const getOnlineHubIds = () =>
  Array.from(onlineHubs.keys()).filter((id) => (onlineHubs.get(id)?.size || 0) > 0);

const trackUserSocket = (userId, socketId) => {
  if (!userId || !socketId) return;
  const uid = userId.toString();
  if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
  onlineUsers.get(uid).add(socketId);

  if (!socketSubscriptions.has(socketId)) {
    socketSubscriptions.set(socketId, { userIds: new Set(), hubIds: new Set() });
  }
  socketSubscriptions.get(socketId).userIds.add(uid);
};

const trackHubSocket = (hubId, socketId) => {
  if (!hubId || !socketId) return;
  const hid = hubId.toString();
  if (!onlineHubs.has(hid)) onlineHubs.set(hid, new Set());
  onlineHubs.get(hid).add(socketId);

  if (!socketSubscriptions.has(socketId)) {
    socketSubscriptions.set(socketId, { userIds: new Set(), hubIds: new Set() });
  }
  socketSubscriptions.get(socketId).hubIds.add(hid);
};

const untrackSocket = (socketId) => {
  const subs = socketSubscriptions.get(socketId);
  if (!subs) return;

  for (const uid of subs.userIds) {
    const userSet = onlineUsers.get(uid);
    if (userSet) {
      userSet.delete(socketId);
      if (userSet.size === 0) onlineUsers.delete(uid);
    }
  }

  for (const hid of subs.hubIds) {
    const hubSet = onlineHubs.get(hid);
    if (hubSet) {
      hubSet.delete(socketId);
      if (hubSet.size === 0) onlineHubs.delete(hid);
    }
  }

  socketSubscriptions.delete(socketId);
};

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
          const user = await User.findById(decoded.id);
          if (!user || (decoded.tokenVersion || 0) !== (user.tokenVersion || 0) || decoded.purpose === "activation" || ownerState(user) !== "ACTIVE") return next(new Error("Account activation or password change required."));
          if (user.ownerAccess?.mustChangePassword) {
            const timer = setTimeout(() => socket.disconnect(true), Math.max(1, new Date(user.ownerAccess.passwordChangeDeadline).getTime() - Date.now()));
            timer.unref?.(); socket.on("disconnect", () => clearTimeout(timer));
          }
          socket.user = {
            _id: decoded.id,
            id: decoded.id,
            role: user.role,
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
    socketSubscriptions.set(socket.id, { userIds: new Set(), hubIds: new Set() });

    // Automatically mark user online if connected with valid token
    if (socket.user?._id || socket.user?.id) {
      const uid = socket.user._id || socket.user.id;
      trackUserSocket(uid, socket.id);
    }

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
          trackHubSocket(businessId, socket.id);
          return;
        }

        const business = await Business.findById(businessId);
        if (business && business.approvalStatus === "approved" && business.owner.toString() === socket.user.id.toString()) {
          socket.join(`business:${businessId}:admin`);
          trackHubSocket(businessId, socket.id);
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

      // Allow users to join their private updates
      if (!socket.user || (socket.user.id.toString() !== userId.toString() && socket.user.role !== "admin")) {
        socket.emit("error", { message: "Access denied to foreign user notifications" });
        return;
      }

      socket.join(`user:${userId}`);
      trackUserSocket(userId, socket.id);
    });

    // Booking-specific chat room
    socket.on("join:booking", async ({ bookingId }) => {
      if (!bookingId || !socket.user) return;
      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return;
        let allowed = socket.user.role === "admin" || (booking.userId?._id || booking.userId)?.toString() === socket.user.id.toString();
        if (!allowed && socket.user.role === "owner") {
          const businessId = booking.businessId?._id || booking.businessId;
          allowed = Boolean(await Business.findOne({_id:businessId,owner:socket.user.id,approvalStatus:"approved"}));
        }
        if (allowed) socket.join(`booking:${bookingId}`);
        else socket.emit("error", {message:"Access denied to this booking."});
      } catch {
        socket.emit("error", {message:"Unable to join this booking."});
      }
    });

    // Leave rooms
    socket.on("leave:room", ({ businessId, userId, bookingId }) => {
      if (businessId) {
        socket.leave(`business:${businessId}`);
        socket.leave(`business:${businessId}:admin`);
        const subs = socketSubscriptions.get(socket.id);
        if (subs) {
          subs.hubIds.delete(businessId.toString());
          const hubSet = onlineHubs.get(businessId.toString());
          if (hubSet) {
            hubSet.delete(socket.id);
            if (hubSet.size === 0) onlineHubs.delete(businessId.toString());
          }
        }
      }
      if (userId) {
        socket.leave(`user:${userId}`);
      }
      if (bookingId) {
        socket.leave(`booking:${bookingId}`);
      }
    });

    socket.on("disconnect", () => {
      untrackSocket(socket.id);
    });
  });
};
