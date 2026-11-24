import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import User from './auth.model.js';
import { phoneRevisionFilter, recentPhoneAuthorization } from './phone-security.js';
import { sanitize } from './auth.service.js';
import { hasVerifiedPhone, normalizePhoneNumber } from '../../utils/phoneNumbers.js';
import ApiError from '../../../utils/ApiError.js';
import { beginDelivery, markDeliveryRejected, recordDelivery } from '../whatsapp/whatsapp-delivery.model.js';

const unavailable = () => new ApiError(503, 'Phone verification is temporarily unavailable.');
const invalid = () => new ApiError(400, 'That verification code is invalid or expired. Request a new code if needed.');
function details({ user, phone: rawPhone, authTime, session }) {
  const phone = normalizePhoneNumber(rawPhone);
  if (!phone) throw new ApiError(400, 'Enter a valid phone number including the country code.');
  const current = normalizePhoneNumber(user.phone);
  if (hasVerifiedPhone(user) && current !== phone && !recentPhoneAuthorization(authTime)) {
    throw new ApiError(403, 'Sign in again before changing your verified phone number.');
  }
  const purpose = current === phone ? 'verify_phone' : current ? 'phone_change' : 'registration';
  return { phone, purpose, account: String(user._id), revision: user.phoneRevision || 0, session };
}

async function useStore(operation) {
  try { return await operation(); }
  catch { throw unavailable(); }
}

export function createPhoneVerification({ config, store, provider, users = User,
  deliveries = { beginDelivery, markDeliveryRejected, recordDelivery } }) {
  const proof = (scope, id, otp) => store.digest('otp', scope.account, scope.phone, scope.purpose, scope.revision, scope.session, id, otp);

  return {
    async send(input) {
      const scope = details(input);
      const id = randomUUID();
      const otp = String(randomInt(1_000_000)).padStart(6, '0');
      const challenge = { id, proof: proof(scope, id, otp), attempts: 0 };
      const allowed = await useStore(() => store.reserve({ account: scope.account, phone: scope.phone, ip: input.ip, challenge }));
      if (!allowed) {
        throw Object.assign(new ApiError(429, 'Wait before requesting another verification code.'), { retryAfterSeconds: config.cooldown });
      }

      try { await deliveries.beginDelivery(id, 'otp'); }
      catch {
        await useStore(() => store.clear(scope.account, id));
        throw unavailable();
      }
      try {
        const providerId = await provider.otp(scope.phone, otp, id);
        await deliveries.recordDelivery({ callback: id, providerId, status: 'accepted', at: new Date() });
      } catch (error) {
        // A timeout can still deliver. Keep the challenge so an arriving code remains usable.
        const outcome = error.outcome || 'unknown';
        await deliveries.markDeliveryRejected(id, outcome).catch(() => {});
        if (outcome === 'permanent' || outcome === 'retry') {
          await useStore(() => store.clear(scope.account, id));
        }
      }
      return { challengeId: id, purpose: scope.purpose, resendAfterSeconds: config.cooldown };
    },

    async verify(input) {
      const scope = details(input);
      const { challengeId, purpose, otp } = input;
      if (typeof challengeId !== 'string' || !/^[a-f0-9-]{36}$/.test(challengeId) ||
          typeof otp !== 'string' || !/^\d{6}$/.test(otp) || scope.purpose !== purpose) throw invalid();
      const challenge = await useStore(() => store.read(scope.account));
      if (challenge?.id !== challengeId) throw invalid();
      const expected = Buffer.from(challenge.proof, 'hex');
      const candidate = Buffer.from(proof(scope, challengeId, otp), 'hex');
      const matches = expected.length === candidate.length && timingSafeEqual(expected, candidate);
      if (!await useStore(() => store.consume(scope.account, challengeId, matches))) throw invalid();

      const now = new Date();
      const changedNumber = normalizePhoneNumber(input.user.phone) !== scope.phone;
      const fields = {
        phone: scope.phone, isPhoneVerified: true, whatsappVerifiedAt: now,
        phoneVerification: { provider: 'whatsapp', phone: scope.phone, verifiedAt: now },
      };
      const events = [{ action: 'whatsapp_verified', at: now }];
      const update = { $set: fields, $inc: { phoneRevision: 1 }, $push: { whatsappAudit: { $each: events, $slice: -20 } } };
      if (changedNumber) {
        if (input.user.whatsappConsent) events.unshift({ action: 'phone_changed', at: now });
        Object.assign(fields, { whatsappConsent: false, whatsappConsentRevokedAt: now, whatsappFollowUpPhone: '' });
        update.$unset = { whatsappConsentAt: '', whatsappConsentVersion: '' };
      }
      let user;
      try {
        user = await users.findOneAndUpdate(
          {
            _id: input.user._id,
            tokenVersion: input.user.tokenVersion || { $in: [0, null] },
            'revokedSessions.digest': { $ne: createHash('sha256').update(input.session).digest('hex') },
            ...phoneRevisionFilter(input.user),
          },
          update, { returnDocument: 'after', runValidators: true },
        );
      } catch (error) {
        if (error.code === 11000) throw invalid();
        throw unavailable();
      }
      if (!user) throw invalid();
      return { user: sanitize(user) };
    },
  };
}
