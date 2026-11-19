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

// Never interpolate arbitrary client strings into room names.
const roomId = value => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value) ? value.toLowerCase() : null;
const payloadId = (payload, field) => payload && typeof payload === "object" && !Array.isArray(payload) ? roomId(payload[field]) : null;
const refId = value => String(value?._id || value);

const refreshSession = async socket => {
  if (!socket.authToken) throw new Error("Authentication required");
  const decoded = jwt.verify(socket.authToken, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  const id = roomId(decoded.id);
  if (!id || decoded.purpose === "activation") throw new Error("Invalid session");
  const user = await User.findById(id);
  if (!user || (decoded.tokenVersion || 0) !== (user.tokenVersion || 0) || ownerState(user) !== "ACTIVE") throw new Error("Account activation or password change required.");
  socket.user = { _id: id, id, role: user.role };
  return user;
};

const mayJoinPrivateRoom = async (socket, type, id) => {
  const user = socket.user;
  if (!user) return false;
  if (type === "user") return id === user.id;
  if (type === "admin") {
    const business = await Business.findById(id);
    return Boolean(business && (user.role === "admin" || (user.role === "owner" && business.approvalStatus === "approved" && refId(business.owner) === user.id)));
  }
  const booking = await Booking.findById(id);
  if (!booking) return false;
  if (user.role === "admin" || refId(booking.userId) === user.id) return true;
  if (user.role !== "owner") return false;
  return Boolean(await Business.findOne({ _id: booking.businessId?._id || booking.businessId, owner: user.id, approvalStatus: "approved" }));
};

/** Socket rooms are server-owned; private subscriptions require a live session. */
export const initSocket = io => {
  const connections = new Set();
  const grants = new Map();
  const deny = (socket, message) => socket.emit("error", { message });
  const roomName = (type, id) => type === "admin" ? `business:${id}:admin` : `${type}:${id}`;
  const removeGrant = async (socket, room) => {
    const grant = grants.get(socket.id)?.get(room);
    await socket.leave(room);
    grants.get(socket.id)?.delete(room);
    if (grant?.type === "admin") {
      socketSubscriptions.get(socket.id)?.hubIds.delete(grant.id);
      const hubs = onlineHubs.get(grant.id);
      hubs?.delete(socket.id);
      if (!hubs?.size) onlineHubs.delete(grant.id);
    }
  };

  io.use(async (socket, next) => {
    socket.user = null;
    try {
      const headers = socket.handshake.headers || {};
      let token = socket.handshake.auth?.token;
      if (!token && typeof headers.authorization === "string") token = headers.authorization.replace(/^Bearer /, "");
      if (!token && typeof headers.cookie === "string") {
        const cookie = headers.cookie.split(";").map(c => c.trim()).find(c => c.startsWith("token="));
        if (cookie) token = decodeURIComponent(cookie.slice(6));
      }
      // Guests use public rooms; supplied invalid credentials fail closed.
      if (token != null && token !== "") {
        if (typeof token !== "string") throw new Error("Invalid session");
        socket.authToken = token;
        await refreshSession(socket);
      }
      next();
    } catch {
      socket.authToken = null;
      next(new Error("Account activation or password change required. Sign in with a valid session."));
    }
  });

  // Revalidate idle subscriptions after session, role or ownership changes.
  const maintenance = setInterval(async () => {
    for (const socket of connections) {
      try {
        if (socket.authToken) await refreshSession(socket);
        for (const [room, grant] of grants.get(socket.id) || []) {
          if (!await mayJoinPrivateRoom(socket, grant.type, grant.id)) await removeGrant(socket, room);
        }
      } catch {
        untrackSocket(socket.id);
        socket.disconnect(true);
      }
    }
    const rooms = Array.from(io.sockets.adapter.rooms.keys()).filter(r => /^business:[a-f0-9]{24}$/.test(r));
    for (const room of rooms) {
      try { await getQueue(room.slice(9), io); } catch { /* Business may no longer be active. */ }
    }
  }, 30000);
  maintenance.unref?.();
  io.httpServer?.once("close", () => clearInterval(maintenance));

  io.on("connection", socket => {
    connections.add(socket);
    grants.set(socket.id, new Map());
    socketSubscriptions.set(socket.id, { userIds: new Set(), hubIds: new Set() });
    if (socket.user) {
      const id = socket.user.id;
      socket.join(`user:${id}`);
      grants.get(socket.id).set(`user:${id}`, { type: "user", id });
      trackUserSocket(id, socket.id);
    }
    socket.on("join:room", payload => {
      const id = payloadId(payload, "businessId");
      if (!id) return deny(socket, "Invalid business ID");
      socket.join(`business:${id}`);
    });
    const privateJoin = (event, field, type) => socket.on(event, async payload => {
      const id = payloadId(payload, field);
      if (!id) return deny(socket, "Invalid room ID");
      try {
        await refreshSession(socket);
        if (!await mayJoinPrivateRoom(socket, type, id)) {
          await removeGrant(socket, roomName(type, id));
          return deny(socket, "Access denied to this private room.");
        }
        // A lookup can finish after the socket has disconnected.
        if (!connections.has(socket)) return;
        const room = roomName(type, id);
        await socket.join(room);
        if (!connections.has(socket)) {
          await socket.leave(room);
          return;
        }
        grants.get(socket.id)?.set(room, { type, id });
        if (type === "admin") trackHubSocket(id, socket.id);
      } catch {
        deny(socket, "Private room authorization failed");
        if (socket.authToken) {
          untrackSocket(socket.id);
          socket.disconnect(true);
        }
      }
    });
    privateJoin("join:admin", "businessId", "admin");
    privateJoin("join:user", "userId", "user");
    privateJoin("join:booking", "bookingId", "booking");
    socket.on("leave:room", async payload => {
      const businessId = payloadId(payload, "businessId");
      const userId = payloadId(payload, "userId");
      const bookingId = payloadId(payload, "bookingId");
      if (businessId) {
        await socket.leave(`business:${businessId}`);
        await removeGrant(socket, `business:${businessId}:admin`);
      }
      if (userId) await removeGrant(socket, `user:${userId}`);
      if (bookingId) await removeGrant(socket, `booking:${bookingId}`);
    });
    socket.on("disconnect", () => {
      connections.delete(socket);
      grants.delete(socket.id);
      untrackSocket(socket.id);
    });
  });
};
