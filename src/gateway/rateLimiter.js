/**
 * Sliding Window In-Memory Rate Limiter
 * Protects endpoints from abuse and brute-force attacks.
 */
class SlidingWindowRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000; // default 1 minute
    this.max = options.max || 180; // default 180 requests per minute
    this.message = options.message || "Too many requests from this IP, please try again later.";
    this.hits = new Map();

    // Auto-cleanup stale entries every 2 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of this.hits.entries()) {
        const valid = timestamps.filter((t) => now - t < this.windowMs);
        if (valid.length === 0) {
          this.hits.delete(key);
        } else {
          this.hits.set(key, valid);
        }
      }
    }, 2 * 60 * 1000).unref?.();
  }

  middleware() {
    return (req, res, next) => {
      const key = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anonymous";
      const now = Date.now();
      const userTimestamps = this.hits.get(key) || [];
      const windowStart = now - this.windowMs;

      const validTimestamps = userTimestamps.filter((t) => t > windowStart);

      if (validTimestamps.length >= this.max) {
        const oldest = validTimestamps[0];
        const resetTime = Math.ceil((oldest + this.windowMs - now) / 1000);
        res.setHeader("Retry-After", resetTime);
        res.setHeader("X-RateLimit-Limit", this.max);
        res.setHeader("X-RateLimit-Remaining", 0);
        res.setHeader("X-RateLimit-Reset", Math.ceil((oldest + this.windowMs) / 1000));
        return res.status(429).json({
          success: false,
          statusCode: 429,
          message: this.message,
          retryAfterSeconds: resetTime,
        });
      }

      validTimestamps.push(now);
      this.hits.set(key, validTimestamps);

      res.setHeader("X-RateLimit-Limit", this.max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, this.max - validTimestamps.length));
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + this.windowMs) / 1000));

      next();
    };
  }
}

export const createRateLimiter = (options) => new SlidingWindowRateLimiter(options).middleware();

// Standard gateway limiter: 180 req/min
export const globalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 180,
  message: "Rate limit exceeded. Please slow down your requests.",
});

// Sensitive auth limiter: 30 req/min
export const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many login/signup attempts. Please wait a minute and try again.",
});
