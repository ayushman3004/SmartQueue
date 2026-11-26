import { hasWhatsAppVerifiedPhone } from '../utils/phoneNumbers.js';

export const visitNoticeConsentVersion = 'clinic-visit-v1';

export function hasVisitNoticeConsent(user, eventAt = new Date()) {
  const consent = user?.clinicVisitWhatsAppConsent;
  return Boolean(user?.role === 'customer' && hasWhatsAppVerifiedPhone(user) &&
    consent?.enabled && consent.version === visitNoticeConsentVersion && consent.grantedAt && consent.phone === user.phoneVerification.phone &&
    new Date(consent.grantedAt) <= eventAt && consent.phoneProofAt &&
    new Date(consent.phoneProofAt).getTime() === new Date(user.whatsappVerifiedAt).getTime());
}
