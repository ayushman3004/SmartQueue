const hexSecret = /^[0-9a-f]{64}$/i;
const templateName = /^[a-z0-9_]{1,512}$/;

export function whatsappConfig(env = process.env) {
  for (const flag of ['WHATSAPP_ENABLED', 'WHATSAPP_NOTIFICATION_WORKER_ENABLED']) {
    if (env[flag] !== undefined && !['', 'true', 'false'].includes(env[flag])) throw new Error(`Invalid ${flag}`);
  }
  const enabled = env.WHATSAPP_ENABLED === 'true';
  const workerEnabled = env.WHATSAPP_NOTIFICATION_WORKER_ENABLED === 'true';
  if (!enabled) {
    if (workerEnabled) throw new Error('Enable WhatsApp before enabling its notification worker');
    return { enabled, workerEnabled };
  }

  function required(name, pattern) {
    const value = env[name]?.trim();
    if (!value || (pattern && !pattern.test(value))) throw new Error(`Set a valid ${name} for WhatsApp`);
    return value;
  }

  function number(name, fallback, min, max) {
    const value = env[name] || fallback;
    if (!/^\d+$/.test(String(value)) || Number(value) < min || Number(value) > max) throw new Error(`Invalid ${name}`);
    return Number(value);
  }

  const config = {
    enabled, workerEnabled,
    accessToken: required('WHATSAPP_ACCESS_TOKEN', /^\S+$/),
    phoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID', /^\d{1,32}$/),
    businessAccountId: required('WHATSAPP_BUSINESS_ACCOUNT_ID', /^\d{1,32}$/),
    appSecret: required('WHATSAPP_APP_SECRET', /^[0-9a-f]{32}$/i),
    verifyToken: required('WHATSAPP_WEBHOOK_VERIFY_TOKEN', /^[A-Za-z0-9_-]{24,128}$/),
    graphVersion: required('WHATSAPP_GRAPH_API_VERSION', /^v\d{1,3}\.\d{1,3}$/),
    language: required('WHATSAPP_TEMPLATE_LANGUAGE', /^[a-z]{2,3}(?:_[A-Z]{2})?$/),
    otpTemplate: required('WHATSAPP_OTP_TEMPLATE', templateName),
    documentTemplate: required('WHATSAPP_DOCUMENT_TEMPLATE', templateName),
    otpSecret: required('WHATSAPP_OTP_HMAC_SECRET', hexSecret),
    redisUrl: required('REDIS_URL', /^rediss?:\/\//),
    ttl: number('WHATSAPP_OTP_TTL_SECONDS', 300, 60, 300),
    cooldown: number('WHATSAPP_OTP_RESEND_SECONDS', 60, 60, 600),
    maxAttempts: number('WHATSAPP_OTP_MAX_ATTEMPTS', 5, 1, 5),
    dailyLimit: number('WHATSAPP_DAILY_MESSAGE_LIMIT', '', 1, 100000),
    phoneLimit: number('WHATSAPP_OTP_PHONE_DAILY_LIMIT', 5, 1, 100),
    accountLimit: number('WHATSAPP_OTP_ACCOUNT_DAILY_LIMIT', 8, 1, 100),
    ipLimit: number('WHATSAPP_OTP_IP_DAILY_LIMIT', 30, 1, 10000),
    globalLimit: number('WHATSAPP_OTP_GLOBAL_DAILY_LIMIT', 200, 1, 100000),
  };
  required('TURNSTILE_SECRET_KEY');
  required('TURNSTILE_ALLOWED_HOSTNAMES');
  if ([env.JWT_SECRET, env.RATE_LIMIT_KEY_SECRET, env.PRESCRIPTION_ENCRYPTION_KEY].includes(config.otpSecret)) {
    throw new Error('WHATSAPP_OTP_HMAC_SECRET must be independent of other application keys');
  }
  if (config.otpTemplate === config.documentTemplate) throw new Error('Use separate WhatsApp authentication and utility templates');
  return config;
}
