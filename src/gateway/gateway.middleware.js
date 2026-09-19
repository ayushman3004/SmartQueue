import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../modules/auth/auth.model.js";

/**
 * Attaches a unique Request ID (UUID) to every incoming request.
 * Exposes it in the `X-Request-Id` response header for tracing.
 */
export const requestIdMiddleware = (req, res, next) => {
  const reqId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader("X-Request-Id", reqId);
  next();
};

/**
 * Gateway JWT authentication middleware.
 * Verifies Bearer token or cookie, populates `req.user`.
 */
export const gatewayAuthenticate = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Authentication required",
        requestId: req.id,
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "User account not found or deleted",
        requestId: req.id,
      });
    }

    req.user = user;
    next();
  } catch (err) {
    const isExpired = err.name === "TokenExpiredError";
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: isExpired ? "Session expired, please login again" : "Invalid authentication token",
      requestId: req.id,
    });
  }
};

/**
 * Gateway Role Authorization Middleware.
 * Usage: gatewayAuthorize("owner", "admin")
 */
export const gatewayAuthorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: "Authentication required",
      requestId: req.id,
    });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      statusCode: 403,
      message: `Forbidden: role '${req.user.role}' is not authorized to access this resource`,
      requestId: req.id,
    });
  }

  next();
};

/**
 * Centralized Gateway Error Handler.
 * Formats errors consistently, scrubs stack traces in production, and includes the Request ID.
 */
export const gatewayErrorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    message = messages.join(", ");
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid format for field ${err.path}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `Duplicate entry for ${field}`;
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  if (statusCode >= 500) {
    console.error(`[${req.id}] 🔥 Server Error:`, err);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    requestId: req.id,
    ...(process.env.NODE_ENV !== "production" && statusCode >= 500 ? { stack: err.stack } : {}),
  });
};
