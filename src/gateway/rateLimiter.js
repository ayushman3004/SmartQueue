import { createHmac, randomBytes } from "node:crypto";
import ipaddr from "ipaddr.js";
import { createMemoryRateLimitStore } from "./rateLimitStore.js";

const localStore = createMemoryRateLimitStore();
const localKeySecret = randomBytes(32);

export function ipKey(req) {
  const address = req.clientIp || req.ip;
  if (!address || !ipaddr.isValid(address)) return "unknown";
  const ip = ipaddr.process(address);
  if (ip.kind() === "ipv4") return ip.toString();
  return ip.parts.slice(0, 4).map(part => part.toString(16)).join(":") + "::/64";
}

export function createRateLimiter({
  name = "default", max = 180, windowMs = 60_000, key = ipKey, failOpen = false,
  message = "Too many requests. Please try again later.",
} = {}) {
  return async (req, res, next) => {
    const identity = key(req);
    if (!identity || req.method === "OPTIONS") return next();
    const store = req.app?.locals.rateLimitStore ?? localStore;
    const secret = req.app?.locals.rateLimitKeySecret ?? localKeySecret;
    const digest = createHmac("sha256", secret).update(identity).digest("hex");
    let result;
    try {
      result = await store.consume(`serveq:ratelimit:v1:${name}:${digest}`, { max, windowMs });
    } catch {
      store.reportUnavailable?.();
      if (failOpen) return next();
      res.setHeader("Retry-After", "5");
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({
        success: false, statusCode: 503, message: "Please try again in a few seconds.", retryAfterSeconds: 5,
      });
    }

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - result.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil((result.now + result.retryMs) / 1000));
    if (result.allowed) return next();

    const retryAfterSeconds = Math.max(1, Math.ceil(result.retryMs / 1000));
    res.setHeader("Retry-After", retryAfterSeconds);
    res.setHeader("Cache-Control", "no-store");
    return res.status(429).json({ success: false, statusCode: 429, message, retryAfterSeconds });
  };
}

export const globalLimiter = createRateLimiter({
  name: "api",
  failOpen: true,
  message: "Rate limit exceeded. Please slow down your requests.",
});
