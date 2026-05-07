import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

export const comparePassword = async (password, hashed) => {
  return await bcrypt.compare(password, hashed);
};

export const generateToken = (user) => {
  return jwt.sign(
    { id: user._id || user, role: user.role || "user" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/**
 * Set JWT as an HTTP-only cookie.
 * 
 * Production (cross-domain Vercel→Render) requirements:
 *   - secure: true   (HTTPS only)
 *   - sameSite: "none" (allow cross-origin cookie sending)
 *   - trust proxy must be set on Express app
 * 
 * Development:
 *   - secure: false
 *   - sameSite: "lax" (same-origin is fine for localhost)
 */
export const setTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
};
