// Shared with the SMS client so profile edits and token comparisons agree.
export function normalizePhoneNumber(value, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') return null
  const phone = value.trim().replace(/[\s()-]/g, '')
  if (!phone) return allowEmpty ? '' : null
  if (/^[6-9]\d{9}$/.test(phone)) return `+91${phone}`
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null
}

export function hasVerifiedPhone(user) {
  const phone = normalizePhoneNumber(user?.phone)
  const proof = user?.phoneVerification
  return Boolean(user?.isPhoneVerified && phone && proof?.provider === 'firebase' && proof.verifiedAt &&
    proof.phone === phone && Number.isFinite(new Date(proof.verifiedAt).getTime()))
}

export function canSendWhatsAppFollowUps(user) {
  return user?.role === 'customer' && hasVerifiedPhone(user) &&
    user.whatsappFollowUpPhone === normalizePhoneNumber(user.phone)
}
