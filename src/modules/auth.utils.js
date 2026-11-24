import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

export const comparePassword = async (password, hashed) => {
  return await bcrypt.compare(password, hashed);
};

export const generateToken = (user, adminAccess) => {
  return jwt.sign(
    { id: user._id || user, role: user.role || "user", tokenVersion: user.tokenVersion || 0, purpose: user.ownerAccess?.status === "INVITED" ? "activation" : "session",
      ...(adminAccess && {
        adminAccessEmail: adminAccess.email,
        adminAccessTeam: adminAccess.team,
        adminAccessAudience: adminAccess.audience,
        exp: adminAccess.expiresAt,
      }),
    },
    process.env.JWT_SECRET,
    { ...(!adminAccess && { expiresIn: "7d" }), jwtid: randomUUID() }
  );
};

// Production security must not depend on forwarded headers or proxy detection.
export const tokenCookieOptions = (req = null) => {
  const sameSite = (process.env.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase();
  if (!["lax", "strict", "none"].includes(sameSite)) throw new Error("Invalid AUTH_COOKIE_SAME_SITE configuration");
  return { httpOnly: true, secure: process.env.NODE_ENV === "production" || Boolean(req?.secure) || sameSite === "none", sameSite, path: "/" };
};

export const setTokenCookie = (res, token, req = null, adminAccess) => {
  res.cookie("token", token, { ...tokenCookieOptions(req), maxAge: adminAccess ? Math.max(0, adminAccess.expiresAt * 1000 - Date.now()) : 7 * 24 * 60 * 60 * 1000 });
};

export const responseToken = (req, token) =>
  req.get("X-ServeQ-Session") === "cookie" ? {} : { token };

export const clearTokenCookie = (res, req = null) => {
  res.clearCookie("token", tokenCookieOptions(req));
};
