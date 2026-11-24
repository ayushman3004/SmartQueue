import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import User from "./auth.model.js";

export const sessionTokenFrom = req => req.headers.authorization?.startsWith("Bearer ")
  ? req.headers.authorization.slice(7)
  : req.cookies?.token;

export const verifySessionToken = token => jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

const sessionDigest = token => createHash("sha256").update(token).digest("hex");

export function isCurrentSession(user, claims, token) {
  if (!user || (claims.tokenVersion || 0) !== (user.tokenVersion || 0)) return false;
  if (!user.revokedSessions?.length) return true;
  const digest = sessionDigest(token);
  return !user.revokedSessions.some(session => session.digest === digest);
}

export async function revokeSession(token, io) {
  if (!token) return;
  let claims;
  try {
    claims = verifySessionToken(token);
  } catch {
    return; // Expired or invalid credentials can be cleared without a database write.
  }
  if (typeof claims.id !== "string" || !/^[a-f0-9]{24}$/i.test(claims.id)) return;

  const now = new Date();
  const digest = sessionDigest(token);
  const expiresAt = new Date(claims.exp * 1000);
  if (!Number.isFinite(claims.exp)) {
    // Legacy tokens issued by ServeQ always have an expiry. Revoke an older
    // signed credential without one through its account version.
    const version = claims.tokenVersion || 0;
    const filter = version ? { tokenVersion: version } : { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] };
    await User.updateOne({ _id: claims.id, ...filter }, { $inc: { tokenVersion: 1 } });
  } else {
    await User.updateOne({ _id: claims.id }, [{
      $set: {
        revokedSessions: {
          $concatArrays: [{
            $filter: {
              input: { $ifNull: ["$revokedSessions", []] },
              as: "session",
              cond: { $and: [
                { $gt: ["$$session.expiresAt", now] },
                { $ne: ["$$session.digest", digest] },
              ] },
            },
          }, [{ digest, expiresAt }]],
        },
      },
    }], { updatePipeline: true });
  }
  const sockets = io?.sockets;
  for (const id of sockets?.adapter.rooms.get(`user:${claims.id}`) ?? []) {
    const socket = sockets.sockets.get(id);
    if (socket?.authToken === token) socket.disconnect(true);
  }
}
