import { randomUUID } from "node:crypto";
import { createClient } from "redis";

const SLIDING_WINDOW = `
local time = redis.call("TIME")
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local window = tonumber(ARGV[1])
local max = tonumber(ARGV[2])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now - window)
local count = redis.call("ZCARD", KEYS[1])
local allowed = 0
if count < max then
  redis.call("ZADD", KEYS[1], now, ARGV[3])
  redis.call("PEXPIRE", KEYS[1], window)
  count = count + 1
  allowed = 1
end
local oldest = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
return {allowed, count, now, tonumber(oldest[2]) + window - now}
`;

export function createRedisRateLimitStore(url) {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    commandsQueueMaxLength: 1000,
    socket: { connectTimeout: 3000 },
  });
  let lastWarning = 0;
  const reportUnavailable = () => {
    const now = Date.now();
    if (now - lastWarning < 60_000) return;
    lastWarning = now;
    console.warn("Rate limit store unavailable");
  };
  client.on("error", reportUnavailable);
  async function execute(operation) {
    if (!client.isReady) throw new Error("Redis store unavailable");
    const command = operation(client.withCommandOptions({ timeout: 250 }));
    // Bound waiting for commands that have already reached the socket.
    let timer;
    const deadline = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Redis store timed out")), 250);
    });
    try {
      return await Promise.race([command, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    connect: () => client.connect(),
    close: () => { if (client.isOpen) client.destroy(); },
    reportUnavailable,
    async consume(key, { max, windowMs }) {
      const [allowed, count, now, retryMs] = await execute(redis => redis.eval(
        SLIDING_WINDOW,
        { keys: [key], arguments: [String(windowMs), String(max), randomUUID()] },
      ));
      return { allowed: allowed === 1, count, now, retryMs };
    },
    async claimOnce(key, ttlMs) {
      return await execute(redis => redis.set(key, "1", { NX: true, PX: ttlMs })) === "OK";
    },
  };
}

// Local single-process development and tests only.
export function createMemoryRateLimitStore() {
  const entries = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.expires <= now) entries.delete(key);
    }
  }, 60_000).unref?.();
  return {
    consume(key, { max, windowMs }) {
      const now = Date.now();
      const hits = (entries.get(key)?.hits ?? []).filter(time => time > now - windowMs);
      const allowed = hits.length < max;
      if (allowed) {
        hits.push(now);
        entries.set(key, { hits, expires: now + windowMs });
      }
      return { allowed, count: hits.length, now, retryMs: hits[0] + windowMs - now };
    },
  };
}

export function configureRateLimitStore(app, env = process.env) {
  const url = env.REDIS_URL;
  if (!url && env.NODE_ENV !== "production") return;
  if (!url || !/^rediss?:\/\//.test(url)) throw new Error("Set REDIS_URL to a redis:// or rediss:// endpoint");
  const secret = env.RATE_LIMIT_KEY_SECRET;
  if (!secret || secret.length !== 64 || !/^[0-9a-f]+$/.test(secret)) {
    throw new Error("RATE_LIMIT_KEY_SECRET must be 64 lowercase hexadecimal characters");
  }
  const store = createRedisRateLimitStore(url);
  app.locals.rateLimitStore = store;
  app.locals.rateLimitKeySecret = Buffer.from(secret, "hex");
  // MongoDB readiness and signed payment delivery remain independent of Redis.
  void store.connect().catch(store.reportUnavailable);
  return store;
}
