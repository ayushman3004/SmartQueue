import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

const isValidSecret = value =>
  typeof value === "string" && value.length === 64 && /^[a-f0-9]+$/.test(value);

export function createCloudflareOriginGuard(secret) {
  if (secret === undefined || secret === "") return (_req, _res, next) => next();
  if (!isValidSecret(secret)) throw new Error("CLOUDFLARE_ORIGIN_SECRET must be 64 lowercase hexadecimal characters");

  const expected = Buffer.from(secret, "hex");
  return (req, res, next) => {
    // Render's health checks go directly to the instance and cannot carry the edge credential.
    const path = req.url.split("?", 1)[0];
    if ((req.method === "GET" || req.method === "HEAD") && (path === "/live" || path === "/ready")) {
      return next();
    }

    const credential = req.headers["x-serveq-origin-auth"];
    const clientIp = req.headers["x-serveq-client-ip"];
    if (isValidSecret(credential) &&
        timingSafeEqual(Buffer.from(credential, "hex"), expected) &&
        typeof clientIp === "string" && isIP(clientIp)) {
      req.clientIp = clientIp;
      return next();
    }

    res.writeHead(404, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end('{"message":"Not found"}');
  };
}

export const cloudflareOriginGuard = createCloudflareOriginGuard(process.env.CLOUDFLARE_ORIGIN_SECRET);
