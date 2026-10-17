import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

export const app = !getApps().length
  ? initializeApp(
      isFirebaseConfigured
        ? firebaseConfig
        : {
            apiKey: "placeholder-api-key",
            authDomain: "serveq-auth.firebaseapp.com",
            projectId: "serveq-auth",
            appId: "1:000000000000:web:0000000000000000",
          }
    )
  : getApp();

export const auth = getAuth(app);

/**
 * Initializes Invisible reCAPTCHA verifier for Firebase Phone Auth
 */
export const setupRecaptcha = (containerId = "recaptcha-container") => {
  if (typeof window === "undefined") return null;

  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      console.warn("Could not clear recaptchaVerifier:", e);
    }
  }

  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {
      // reCAPTCHA solved
    },
    "expired-callback": () => {
      console.warn("reCAPTCHA expired. Please request OTP again.");
    },
  });

  return window.recaptchaVerifier;
};

/**
 * Sends Phone Number OTP via Firebase Phone Auth directly to mobile device
 */
export const sendFirebasePhoneOtp = async (phoneNumber, containerId = "recaptcha-container") => {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase credentials are not set in .env. Please configure VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID."
    );
  }

  // Ensure E.164 international format (e.g. +91 7888746047)
  let cleanNumber = phoneNumber.trim().replace(/[\s\-()]/g, "");
  if (!cleanNumber.startsWith("+")) {
    // Default to +91 if Indian 10-digit number
    cleanNumber = cleanNumber.length === 10 ? `+91${cleanNumber}` : `+${cleanNumber}`;
  }

  const verifier = setupRecaptcha(containerId);
  const confirmationResult = await signInWithPhoneNumber(auth, cleanNumber, verifier);
  window.confirmationResult = confirmationResult;
  return confirmationResult;
};

/**
 * Verifies the 6-digit OTP code with Firebase
 */
export const verifyFirebasePhoneOtp = async (otp, confirmationResultOverride) => {
  const confirmation = confirmationResultOverride || window.confirmationResult;
  if (!confirmation) {
    throw new Error("No active OTP session found. Please click Resend Code.");
  }
  const result = await confirmation.confirm(otp.trim());
  return result.user;
};
