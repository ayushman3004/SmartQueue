import User from './auth.model.js';
import { sanitize } from './auth.service.js';
import { phoneRevisionFilter, whatsappConsentVersion } from './phone-security.js';
import { hasWhatsAppVerifiedPhone } from '../../utils/phoneNumbers.js';
import ApiError from '../../../utils/ApiError.js';

export async function updateWhatsAppConsent(user, enabled, version) {
  if (user.role !== 'customer') throw new ApiError(403, 'This preference is available to patients.');
  if (typeof enabled !== 'boolean' || (enabled && version !== whatsappConsentVersion)) {
    throw new ApiError(400, 'Confirm the current WhatsApp notification preference.');
  }
  if (enabled && !hasWhatsAppVerifiedPhone(user)) {
    throw new ApiError(400, 'Verify your current phone on WhatsApp first.');
  }
  const now = new Date();
  const update = enabled
    ? { whatsappConsent: true, whatsappConsentAt: now, whatsappConsentVersion }
    : { whatsappConsent: false, whatsappConsentRevokedAt: now };
  const saved = await User.findOneAndUpdate(
    { _id: user._id, ...phoneRevisionFilter(user) },
    { $set: update, $inc: { phoneRevision: 1 }, $push: { whatsappAudit: {
      $each: [{ action: enabled ? 'consent_granted' : 'consent_revoked', at: now, version: whatsappConsentVersion }],
      $slice: -20,
    } } },
    { returnDocument: 'after' },
  );
  if (!saved) throw new ApiError(409, 'Your phone preference changed. Refresh and try again.');
  return { user: sanitize(saved) };
}
