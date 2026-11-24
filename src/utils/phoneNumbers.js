// Shared by the profile UI and backend to normalize and compare phone numbers.
export function normalizePhoneNumber(value, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || value.length > 50) return null
  const phone = value.trim().replace(/[\s()-]/g, '')
  if (!phone) return allowEmpty ? '' : null
  if (/^[6-9]\d{9}$/.test(phone)) return `+91${phone}`
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null
}

export function hasVerifiedPhone(user) {
  const phone = normalizePhoneNumber(user?.phone)
  const proof = user?.phoneVerification
  return Boolean(user?.isPhoneVerified && phone && ['firebase', 'whatsapp'].includes(proof?.provider) &&
    proof.phone === phone && proof.verifiedAt && Number.isFinite(new Date(proof.verifiedAt).getTime()))
}

export function hasWhatsAppVerifiedPhone(user) {
  return hasVerifiedPhone(user) && user.phoneVerification.provider === 'whatsapp' &&
    Boolean(user.whatsappVerifiedAt && Number.isFinite(new Date(user.whatsappVerifiedAt).getTime()))
}
