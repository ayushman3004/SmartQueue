import { createHash } from "node:crypto";

const siteverify = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const tokenLifetimeMs = 300_000;

export function createTurnstileProtection({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const mode = env.TURNSTILE_MODE || "off";
  if (mode === "off") return () => (_req, _res, next) => next();
  if (!["observe", "enforce"].includes(mode)) throw new Error("Invalid TURNSTILE_MODE");
  const secret = env.TURNSTILE_SECRET_KEY;
  const hostnames = new Set((env.TURNSTILE_ALLOWED_HOSTNAMES || "").toLowerCase().split(",").map(host => host.trim()).filter(Boolean));
  if (!secret?.trim() || !hostnames.size || [...hostnames].some(host => !/^[a-z0-9.-]+$/.test(host))) {
    throw new Error("Set TURNSTILE_SECRET_KEY and TURNSTILE_ALLOWED_HOSTNAMES");
  }

  let lastReport = 0;
  const counts = new Map();
  function report(action, outcome) {
    const key = `${action}:${outcome}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (Date.now() - lastReport < 60_000) return;
    console.info("Turnstile outcomes", Object.fromEntries(counts));
    lastReport = Date.now();
    counts.clear();
  }

  async function verify(token, action, store) {
    if (token == null || token === "") return "missing";
    if (typeof token !== "string" || token.length > 2048 || !token.trim()) return "invalid";
    try {
      if (!store?.claimOnce) return "unavailable";
      const response = await fetchImpl(siteverify, {
        method: "POST",
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(3000),
        redirect: "error",
      });
      if (!response.ok) return "unavailable";
      const result = await response.json();
      if (!result || typeof result.success !== "boolean") return "unavailable";
      if (result["error-codes"]?.some(code => ["internal-error", "invalid-input-secret", "missing-input-secret"].includes(code))) {
        return "unavailable";
      }
      if (!result.success || result.action !== action || !hostnames.has(result.hostname?.toLowerCase())) return "invalid";

      // Siteverify redemption can race across Cloudflare locations.
      const digest = createHash("sha256").update(token).digest("hex");
      const fresh = await store.claimOnce(`serveq:turnstile:v1:${digest}`, tokenLifetimeMs);
      return fresh ? "verified" : "duplicate";
    } catch {
      return "unavailable";
    }
  }

  return (action, { anonymousOnly = false } = {}) => async (req, res, next) => {
    if (anonymousOnly && req.user) return next();
    const token = req.body?.turnstileToken;
    if (req.body && typeof req.body === "object") delete req.body.turnstileToken;
    const outcome = await verify(token, action, req.app.locals.rateLimitStore);
    report(action, outcome);
    if (mode === "observe" || outcome === "verified") return next();
    res.set("Cache-Control", "no-store");
    if (outcome === "unavailable") {
      res.set("Retry-After", "5");
      return res.status(503).json({ success: false, code: "TURNSTILE_UNAVAILABLE", message: "The security check is temporarily unavailable. Please try again." });
    }
    return res.status(403).json({ success: false, code: "TURNSTILE_REQUIRED", message: "Complete the security check and try again." });
  };
}

export const protectWithTurnstile = createTurnstileProtection();
