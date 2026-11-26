import User from './auth.model.js';
import { phoneRevisionFilter } from './phone-security.js';
import { hasWhatsAppVerifiedPhone } from '../../utils/phoneNumbers.js';
import { visitNoticeConsentVersion } from '../../shared/visitNoticeConsent.js';
import ApiError from '../../../utils/ApiError.js';

export async function updateVisitNoticeConsent(user, enabled, version) {
  if (user.role !== 'customer') throw new ApiError(403, 'This preference is available to patients.');
  if (typeof enabled !== 'boolean' || (enabled && version !== visitNoticeConsentVersion)) {
    throw new ApiError(400, 'Confirm the current WhatsApp visit reminder preference.');
  }
  if (enabled && !hasWhatsAppVerifiedPhone(user)) throw new ApiError(400, 'Verify your current phone on WhatsApp first.');

  const revision = user.clinicVisitWhatsAppConsent?.revision || 0;
  const consent = enabled
    ? { enabled, version, grantedAt: new Date(), phoneProofAt: user.whatsappVerifiedAt, phone: user.phoneVerification.phone }
    : { enabled, revokedAt: new Date() };
  const saved = await User.updateOne({ _id: user._id, role: 'customer', ...phoneRevisionFilter(user),
    'clinicVisitWhatsAppConsent.revision': revision || { $in: [0, null] },
  }, { $set: { clinicVisitWhatsAppConsent: { ...consent, revision: revision + 1 } } });
  if (!saved.matchedCount) throw new ApiError(409, 'Your phone preference changed. Refresh and try again.');
  return { enabled };
}
