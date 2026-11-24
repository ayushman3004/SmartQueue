import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createRateLimiter } from '../../gateway/rateLimiter.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import { validCallback, validMessageId } from './whatsapp.client.js';
import { recordDelivery } from './whatsapp-delivery.model.js';

const statuses = new Set(['sent', 'delivered', 'read', 'failed']);
const limiter = createRateLimiter({ name: 'whatsapp-webhook', max: 180, failOpen: true });

export function validWhatsAppSignature(body, signature, secret) {
  if (!Buffer.isBuffer(body) || typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(createHmac('sha256', secret).update(body).digest(), Buffer.from(signature.slice(7), 'hex'));
}

function exactSecret(value, expected) {
  if (typeof value !== 'string' || value.length > 128) return false;
  const submitted = Buffer.from(value);
  const required = Buffer.from(expected);
  return submitted.length === required.length && timingSafeEqual(submitted, required);
}

export function incomingStatuses(body, config) {
  const events = [];
  if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return events;
  for (const entry of body.entry) {
    if (entry?.id !== config.businessAccountId || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      const value = change?.value;
      if (change?.field !== 'messages' || value?.metadata?.phone_number_id !== config.phoneNumberId || !Array.isArray(value.statuses)) continue;
      for (const event of value.statuses) {
        if (!validMessageId(event?.id) || !statuses.has(event.status) ||
            typeof event.timestamp !== 'string' || !/^\d{1,11}$/.test(event.timestamp)) continue;
        events.push({
          providerId: event.id, status: event.status, at: new Date(Number(event.timestamp) * 1000),
          callback: validCallback(event.biz_opaque_callback_data) ? event.biz_opaque_callback_data : undefined,
        });
      }
    }
  }
  return events;
}

const router = Router();
router.use(limiter);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!req.app.locals.whatsapp?.config.enabled) return res.sendStatus(404);
  next();
});
router.get('/', (req, res) => {
  const config = req.app.locals.whatsapp.config;
  const challenge = req.query['hub.challenge'];
  if (req.query['hub.mode'] !== 'subscribe' || typeof challenge !== 'string' || !/^\d{1,128}$/.test(challenge) ||
      !exactSecret(req.query['hub.verify_token'], config.verifyToken)) return res.sendStatus(403);
  res.type('text/plain').send(challenge);
});
router.post('/', asyncHandler(async (req, res) => {
  const config = req.app.locals.whatsapp.config;
  if (!validWhatsAppSignature(req.rawBody, req.get('x-hub-signature-256'), config.appSecret)) return res.sendStatus(403);
  for (const event of incomingStatuses(req.body, config)) await recordDelivery(event);
  res.sendStatus(200);
}));

export default router;
