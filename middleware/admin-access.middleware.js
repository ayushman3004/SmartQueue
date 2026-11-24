import { createPublicKey } from "node:crypto";
import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const isAdminAccessRequired = (env = process.env) => env.NODE_ENV === "production" ||
  Boolean(env.CLOUDFLARE_ADMIN_ACCESS_TEAM || env.CLOUDFLARE_ADMIN_ACCESS_AUD || env.CLOUDFLARE_ADMIN_ACCESS_EMAIL);

export const adminEmail = value => typeof value === "string" ? value.trim().toLowerCase() : "";
const unavailable = () => new ApiError(503, "Administrator Access is unavailable.");
const denied = () => new ApiError(403, "Cloudflare Access is required for administrators.");

export function createAdminAccessGuard({ env = process.env, fetchKeys = (url, options) => fetch(url, options) } = {}) {
  let cache;
  return asyncHandler(async (req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    if (!isAdminAccessRequired(env)) return next();

    const team = env.CLOUDFLARE_ADMIN_ACCESS_TEAM || "";
    const audience = env.CLOUDFLARE_ADMIN_ACCESS_AUD || "";
    const allowedEmail = adminEmail(env.CLOUDFLARE_ADMIN_ACCESS_EMAIL);
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(team) ||
      !/^[a-f0-9]{64}$/.test(audience) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowedEmail)) {
      throw unavailable();
    }

    const token = req.get("Cf-Access-Jwt-Assertion");
    if (!token || token.length > 8192) throw denied();
    const header = jwt.decode(token, { complete: true })?.header;
    if (header?.alg !== "RS256" || typeof header.kid !== "string" || !header.kid || header.kid.length > 128) throw denied();

    const issuer = `https://${team}`;
    if (cache?.issuer !== issuer) cache = { issuer, keys: new Map(), expires: 0, refreshAfter: 0 };
    const state = cache;
    const now = Date.now();
    if ((now >= state.expires || !state.keys.has(header.kid)) && now >= state.refreshAfter) {
      state.refreshAfter = now + 30_000;
      state.refreshing = (async () => {
        const response = await fetchKeys(`${issuer}/cdn-cgi/access/certs`, {
          signal: AbortSignal.timeout(3000), redirect: "error",
        });
        if (!response.ok) throw unavailable();
        const { keys } = await response.json();
        if (!Array.isArray(keys) || keys.length > 16) throw unavailable();
        const validated = keys.filter(key => key.kty === "RSA" && key.alg === "RS256" && key.use === "sig" && typeof key.kid === "string")
          .map(key => [key.kid, createPublicKey({ key, format: "jwk" })]);
        if (validated.length === 0) throw unavailable();
        state.keys = new Map(validated);
        state.expires = Date.now() + 300_000;
      })().catch(() => {}).finally(() => { state.refreshing = undefined; });
    }
    if (state.refreshing && (now >= state.expires || !state.keys.has(header.kid))) await state.refreshing;
    if (Date.now() >= state.expires) throw unavailable();
    const key = state.keys.get(header.kid);
    if (!key) throw denied();

    let claims;
    try {
      claims = jwt.verify(token, key, { algorithms: ["RS256"], issuer, audience });
    } catch {
      throw denied();
    }
    const email = adminEmail(claims.email);
    if (!Number.isSafeInteger(claims.exp) || claims.type !== "app" || !claims.sub || email !== allowedEmail) throw denied();

    req.adminAccess = { email, team, audience, expiresAt: claims.exp };
    next();
  });
}

export const requireAdminAccess = createAdminAccessGuard();

export const matchAdminAccessIdentity = (req, _res, next) => {
  if (isAdminAccessRequired() && req.adminAccess?.email !== adminEmail(req.user?.email)) return next(denied());
  next();
};
