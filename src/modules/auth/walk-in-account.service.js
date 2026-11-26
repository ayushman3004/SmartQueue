import User from './auth.model.js';
import { hasVerifiedPhone, normalizePhoneNumber } from '../../utils/phoneNumbers.js';
import ApiError from '../../../utils/ApiError.js';

export const walkInEmailDomain = '@accounts.serveq.invalid';

export async function findPhoneAccount(phone, session = null, users = User) {
  const accounts = await users.find({ 'phoneVerification.phone': phone,
    $or: [{ 'phoneVerification.provider': 'whatsapp' }, { isPhoneVerified: true }],
  }).select('+walkInAccount').session(session);
  const matches = accounts.filter(account => normalizePhoneNumber(account.phone) === phone &&
    (hasVerifiedPhone(account) || (account.walkInAccount && account.phoneVerification?.provider === 'whatsapp')));
  if (matches.length > 1 || (matches.length === 1 && matches[0].role !== 'customer')) {
    throw new ApiError(409, 'This number cannot be used for patient check-in.');
  }
  return matches[0];
}

export async function provisionWalkInAccount(name, phone, session) {
  const existing = await findPhoneAccount(phone, session);
  if (existing) {
    const normalizedName = value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
    if (normalizedName(existing.name) !== normalizedName(name)) {
      throw new ApiError(409, 'Use the patient’s name as registered with this number.');
    }
    return existing;
  }
  const account = new User({ name, phone, walkInAccount: true });
  account.email = `walk-in-${account._id}${walkInEmailDomain}`;
  // Reserve the same unique phone slot used by WhatsApp proof. An OTP is required to set the verification time.
  account.phoneVerification = { provider: 'whatsapp', phone };
  return account.save({ session });
}
