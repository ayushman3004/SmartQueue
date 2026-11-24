export const recentPhoneAuthorization = authTime =>
  Number.isFinite(authTime) && authTime >= Date.now() / 1000 - 600 && authTime <= Date.now() / 1000 + 30;

export const phoneRevisionFilter = user => user.phoneRevision > 0
  ? { phoneRevision: user.phoneRevision }
  : { phoneRevision: { $in: [0, null] } };

export const whatsappConsentVersion = 'prescription-v1';
