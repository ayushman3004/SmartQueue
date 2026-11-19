import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import ApiError from '../utils/ApiError.js';

const appName = 'serveq-phone-verification';

export async function verifyFirebaseIdToken(idToken) {
  // Admin SDK emulator mode accepts unsigned tokens; never use it for this endpoint.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new ApiError(503, 'Phone verification is unavailable.');
  let app = getApps().find(app => app.name === appName);
  if (!app) {
    try {
      const account = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) : null;
      const projectId = process.env.FIREBASE_PROJECT_ID || account?.project_id || process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId || (account && account.project_id !== projectId)) throw new Error('Invalid project configuration');
      app = initializeApp({ projectId, credential: account ? cert(account) : applicationDefault() }, appName);
    } catch {
      throw new ApiError(503, 'Phone verification is not configured.');
    }
  }
  try {
    // Checks signature, issuer, audience, expiry, revocation and disabled users.
    return await getAuth(app).verifyIdToken(idToken, true);
  } catch (error) {
    if (['auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found', 'auth/argument-error'].includes(error.code)) {
      throw new ApiError(401, 'Invalid or expired phone verification. Request a new SMS code.');
    }
    throw new ApiError(503, 'Phone verification is temporarily unavailable.');
  }
}
