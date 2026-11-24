import { createTurnstileProtection } from '../../../middleware/turnstile.middleware.js';
import User, { whatsappPhoneIndex, whatsappPhoneIndexOptions } from '../auth/auth.model.js';
import Prescription from '../doctor/prescription.model.js';
import { createPhoneVerification } from '../auth/phone-verification.service.js';
import { whatsappConfig } from './whatsapp.config.js';
import { createWhatsAppClient } from './whatsapp.client.js';
import { createWhatsAppOtpStore } from './whatsapp-otp.store.js';
import Delivery from './whatsapp-delivery.model.js';

export function configureWhatsApp(app, redis, env = process.env) {
  const config = whatsappConfig(env);
  if (!config.enabled) return;
  if (!redis?.execute) throw new Error('WhatsApp requires the Redis-backed rate limit store');
  const store = createWhatsAppOtpStore(redis, config);
  const provider = createWhatsAppClient(config);
  // OTP security always enforces Turnstile even when public forms run in observe mode.
  const verifyTurnstile = createTurnstileProtection({ env: { ...env, TURNSTILE_MODE: 'enforce' } })('whatsapp_phone_otp');
  const runtime = { config, store, provider, verifyTurnstile, phone: createPhoneVerification({ config, store, provider }) };
  app.locals.whatsapp = runtime;
  return runtime;
}

export async function ensureWhatsAppIndexes() {
  await User.collection.createIndex(whatsappPhoneIndex, whatsappPhoneIndexOptions);
  await Promise.all([Delivery.createIndexes(), Prescription.createIndexes()]);
}
