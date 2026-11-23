import { getApps, initializeApp } from 'firebase/app'
import { initializeAuth, inMemoryPersistence, RecaptchaVerifier, signInWithPhoneNumber, signOut } from 'firebase/auth'
import { normalizePhoneNumber } from '../utils/phoneNumbers.js'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
}

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.apiKey !== 'placeholder-api-key' && config.authDomain && config.projectId
)
const appName = 'serveq-phone'
const auth = isFirebaseConfigured ? initializeAuth(
  getApps().find(app => app.name === appName) || initializeApp(config, appName),
  { persistence: inMemoryPersistence }
) : null

export async function sendFirebasePhoneOtp(phone, container) {
  if (!auth) throw new Error('Phone verification is temporarily unavailable.')
  const number = normalizePhoneNumber(phone)
  if (!number) throw new Error('Enter a valid phone number with its country code.')
  const verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' })
  try {
    return await signInWithPhoneNumber(auth, number, verifier)
  } finally {
    verifier.clear()
  }
}

export async function confirmFirebasePhoneOtp(confirmation, otp) {
  const { user } = await confirmation.confirm(otp)
  try {
    return await user.getIdToken()
  } finally {
    await signOut(auth)
  }
}
