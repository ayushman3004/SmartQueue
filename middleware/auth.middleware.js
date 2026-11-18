import { ownerState } from "../src/modules/business-application/owner-lifecycle.js";
import Business from "../src/modules/business/business.model.js";
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

  if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) throw new ApiError(401, "Your session changed. Please sign in again.");
  if (user.role === "owner" && user.ownerAccess?.applicationId) {
    const state = ownerState(user);
    const path = req.originalUrl.split("?")[0];
    const security = ["/api/auth/me", "/api/auth/change-password", "/api/auth/logout"];
    const activation = ["/api/auth/me", "/api/auth/email/send-otp", "/api/auth/email/verify-otp", "/api/auth/logout"];
    if (state === "EXPIRED") {
      await User.updateOne({_id:user._id,"ownerAccess.status":"INVITED","ownerAccess.invitationExpiresAt":{$lte:new Date()}},{$set:{"ownerAccess.status":"EXPIRED"},$unset:{"ownerAccess.activationTokenHash":1}});
      throw new ApiError(403, "Your invitation has expired. Ask ServeQ for a new invitation.");
    }
    if (state === "INVITED" && (decoded.purpose !== "activation" || !activation.includes(path) || (path === "/api/auth/me" && req.method !== "GET"))) throw new ApiError(403, "Complete invitation activation and email OTP first.");
    if (state === "PASSWORD_REQUIRED" && (!security.includes(path) || (path === "/api/auth/me" && req.method !== "GET"))) throw new ApiError(403, "Password change required. Open /hub/change-password.");
    if (!["ACTIVE","INVITED","PASSWORD_REQUIRED"].includes(state)) throw new ApiError(403, "Business account access is suspended.");
    if (!security.includes(path) && !activation.includes(path)) {
      const hub = await Business.findOne({owner:user._id,approvalStatus:"approved"});
      if (!hub) throw new ApiError(403, "Business approval is required. Contact ServeQ.");
    }
  }
  req.user = user;
  next();
});

/**
 * Optional authentication: attaches req.user if token is present and valid,
 * but allows unauthenticated requests to proceed.
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (user && (decoded.tokenVersion || 0) === (user.tokenVersion || 0) && ownerState(user) === "ACTIVE" && decoded.purpose !== "activation") req.user = user;
    } catch {
      // Continue as guest
    }
  }
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
    const businessId = req.params?.businessId || (req.originalUrl?.startsWith("/api/businesses/") ? req.params?.id : null);
    if (req.user.role === "owner" && businessId) {
      const hub = await Business.findOne({_id:businessId,owner:req.user._id,approvalStatus:"approved"});
      if (!hub) throw new ApiError(403, "Business not found, not approved, or not owned by this account.");
    }
    next();
  });

/**
 * Require verified email address for sensitive operations like business onboarding
 */
export const requireVerifiedEmail = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new ApiError(401, "Not authenticated");
  const isVerified = Boolean(req.user.isEmailVerified || req.user.authProvider === "google");
  if (!isVerified) {
    throw new ApiError(
      403,
      "Email verification required: You must verify your email address with an OTP before onboarding a business hub."
    );
  }
  next();
});
