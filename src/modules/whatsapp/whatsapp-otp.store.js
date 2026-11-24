import { createHmac } from 'node:crypto';

// A shared Redis hash tag keeps the reservation atomic on cluster-compatible providers.
const reserve = `
if redis.call('EXISTS', KEYS[2]) == 1 or redis.call('EXISTS', KEYS[3]) == 1 then return 0 end
for i = 4, #KEYS do
  if tonumber(redis.call('GET', KEYS[i]) or '0') >= tonumber(ARGV[i]) then return 0 end
end
for i = 4, #KEYS do
  if redis.call('INCR', KEYS[i]) == 1 then redis.call('EXPIRE', KEYS[i], 86400) end
end
redis.call('SET', KEYS[2], '1', 'EX', ARGV[2])
redis.call('SET', KEYS[3], '1', 'EX', ARGV[2])
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
return 1
`;

const consume = `
local stored = redis.call('GET', KEYS[1])
if not stored then return 0 end
local challenge = cjson.decode(stored)
if challenge.id ~= ARGV[1] then return 0 end
if ARGV[2] == '1' then redis.call('DEL', KEYS[1]); return 1 end
challenge.attempts = challenge.attempts + 1
if challenge.attempts >= tonumber(ARGV[3]) then
  redis.call('DEL', KEYS[1])
else
  redis.call('SET', KEYS[1], cjson.encode(challenge), 'KEEPTTL')
end
return 0
`;

const clear = `
local stored = redis.call('GET', KEYS[1])
if stored and cjson.decode(stored).id == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

const budget = `
if tonumber(redis.call('GET', KEYS[1]) or '0') >= tonumber(ARGV[1]) then return 0 end
if redis.call('INCR', KEYS[1]) == 1 then redis.call('EXPIRE', KEYS[1], 86400) end
return 1
`;

export function createWhatsAppOtpStore(redis, config, prefix = 'serveq:{whatsapp}:v1') {
  const digest = (...parts) => createHmac('sha256', Buffer.from(config.otpSecret, 'hex'))
    .update(JSON.stringify(parts)).digest('hex');
  const dailyBudget = `${prefix}:budget`;
  const challengeKey = account => `${prefix}:challenge:${digest('account', account)}`;
  return {
    digest,
    async reserve({ account, phone, ip, challenge }) {
      const keys = [
        challengeKey(account), `${prefix}:cooldown:${digest('account', account)}`,
        `${prefix}:cooldown:${digest('phone', phone)}`, dailyBudget, `${prefix}:otp`,
        `${prefix}:daily:${digest('phone', phone)}`, `${prefix}:daily:${digest('account', account)}`,
        `${prefix}:daily:${digest('ip', ip)}`,
      ];
      const limits = [config.dailyLimit, config.globalLimit, config.phoneLimit, config.accountLimit, config.ipLimit].map(String);
      return await redis.execute(client => client.eval(reserve, {
        keys, arguments: [JSON.stringify(challenge), String(config.cooldown), String(config.ttl), ...limits],
      })) === 1;
    },
    async read(account) {
      const value = await redis.execute(client => client.get(challengeKey(account)));
      return value ? JSON.parse(value) : null;
    },
    async consume(account, id, matches) {
      return await redis.execute(client => client.eval(consume, {
        keys: [challengeKey(account)], arguments: [id, matches ? '1' : '0', String(config.maxAttempts)],
      })) === 1;
    },
    async clear(account, id) {
      await redis.execute(client => client.eval(clear, { keys: [challengeKey(account)], arguments: [id] }));
    },
    async reserveMessage() {
      return await redis.execute(client => client.eval(budget, { keys: [dailyBudget], arguments: [String(config.dailyLimit)] })) === 1;
    },
  };
}
