import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import User from "../src/modules/auth/auth.model.js";

/**
 * Verify JWT and attach user to req.user
 */
export const protect = asyncHandler(async (req, _res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) throw new ApiError(401, "Not authenticated");

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select("-password");
  if (!user) throw new ApiError(401, "User not found");

  req.user = user;
  next();
});

/**
 * Restrict access to specific roles.
 * Usage: allowRoles("owner") or allowRoles("owner", "user")
 * Must be used AFTER protect middleware.
 */
export const allowRoles = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw new ApiError(401, "Not authenticated");
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "Access denied: insufficient permissions");
    }
    next();
  });
