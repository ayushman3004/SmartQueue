import User from './auth.model.js';
import { sanitize } from './auth.service.js';
import { normalizePhoneNumber } from '../../utils/phoneNumbers.js';
import { verifyFirebaseIdToken } from '../../../config/firebase-admin.js';
import ApiError from '../../../utils/ApiError.js';

export function createPhoneVerification({ verifyToken, users = User }) {
  return async ({ userId, phone, idToken }) => {
    const cleanPhone = normalizePhoneNumber(phone);
    if (!cleanPhone) throw new ApiError(400, 'A valid phone number is required.');
    if (typeof idToken !== 'string' || !idToken.trim() || idToken.length > 8192) throw new ApiError(400, 'Phone verification token is required.');
    let proof;
    try { proof = await verifyToken(idToken); }
    catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(401, 'Invalid or expired phone verification. Request a new SMS code.');
    }
    const age = Date.now() / 1000 - proof?.auth_time;
    if (!proof || typeof proof.uid !== 'string' || !proof.uid || proof.firebase?.sign_in_provider !== 'phone' ||
        typeof proof.auth_time !== 'number' || !Number.isFinite(age) || age < -30 || age > 600 ||
        normalizePhoneNumber(proof.phone_number) !== cleanPhone) {
      throw new ApiError(401, 'Phone verification does not match a recent SMS sign-in. Request a new code.');
    }
    const user = await users.findById(userId);
    if (!user) throw new ApiError(404, 'User account not found');
    user.phone = cleanPhone;
    user.isPhoneVerified = true;
    user.phoneVerification = { provider: 'firebase', phone: cleanPhone, verifiedAt: new Date() };
    await user.save();
    return { user: sanitize(user) };
  };
}

export const verifyFirebasePhone = createPhoneVerification({ verifyToken: verifyFirebaseIdToken });
