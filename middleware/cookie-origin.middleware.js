import { allowedOrigins } from "../config/cors.js";
// Bearer requests cannot be forged by a cross-site form. Cookie-only writes need
// a known Origin; CORS alone does not stop the browser sending a forged write.
export const cookieOriginGuard = (req, res, next) => {
  if (
    ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
    !req.cookies?.token ||
    req.headers.authorization?.startsWith("Bearer ")
  )
    return next();
  if (!req.headers.origin || !allowedOrigins.includes(req.headers.origin))
    return res.status(403).json({
      success: false,
      message: "Request origin is not allowed.",
    });
  next();
};
