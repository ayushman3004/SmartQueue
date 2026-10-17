import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  ShieldCheck,
  Mail,
  Smartphone,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Lock,
  AlertTriangle
} from 'lucide-react'
import {
  sendEmailOtp,
  verifyEmailOtp,
  confirmFirebasePhone,
} from '../api/auth.api.js'
import {
  sendFirebasePhoneOtp,
  verifyFirebasePhoneOtp,
  isFirebaseConfigured,
} from '../lib/firebase.js'

export default function VerifyContactModal({
  isOpen,
  onClose,
  type = 'email', // 'email' | 'phone'
  value = '',
  onSuccess,
}) {
  const isEmail = type === 'email'
  const [targetValue, setTargetValue] = useState(value)
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [confirmationResult, setConfirmationResult] = useState(null)

  const handleSendCode = useCallback(async (overrideValue) => {
    const val = (overrideValue !== undefined ? overrideValue : targetValue).trim()
    if (!val) {
      toast.error(`Please provide a valid ${isEmail ? 'email address' : 'phone number'}`)
      return
    }

    setSending(true)
    try {
      if (isEmail) {
        // Email OTP via Nodemailer & nodemailer-otp
        const res = await sendEmailOtp(val)
        toast.success(res.data?.message || `Verification OTP sent to ${val}`, {
          style: {
            borderRadius: '16px',
            background: '#ffffff',
            color: '#09090b',
            border: '1px solid #14b8a6',
          },
        })
      } else {
        // Phone OTP strictly via Firebase Phone Auth
        if (!isFirebaseConfigured) {
          toast.error(
            'Firebase is not yet configured in .env. Please set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID.'
          )
          return
        }
        const confirmResult = await sendFirebasePhoneOtp(val, 'recaptcha-container')
        setConfirmationResult(confirmResult)
        toast.success(`Firebase SMS verification code sent to ${val}`, {
          style: {
            borderRadius: '16px',
            background: '#ffffff',
            color: '#09090b',
            border: '1px solid #14b8a6',
          },
        })
      }

      setCooldown(30)
    } catch (err) {
      let msg = err.message || err.response?.data?.message || 'Failed to send verification code';
      if (err.code === 'auth/billing-not-enabled' || (typeof msg === 'string' && msg.includes('billing-not-enabled'))) {
        msg = 'Firebase Spark plan requires billing for live cellular SMS. Either add this number under "Phone numbers for testing" in Firebase Console (Free) or upgrade to Blaze plan.';
      } else if (err.code === 'auth/operation-not-allowed' || (typeof msg === 'string' && msg.includes('OPERATION_NOT_ALLOWED'))) {
        msg = 'Firebase SMS Region not enabled. In Firebase Console > Authentication > Settings > SMS Region Policy, please enable India (+91) or add your number under "Phone numbers for testing".';
      } else if (err.code === 'auth/invalid-phone-number') {
        msg = 'Invalid phone number format. Please ensure country code is included (e.g. +91 7888746047).';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many requests. Please wait a few minutes before trying again or add phone as test number.';
      } else if (err.code === 'auth/captcha-check-failed') {
        msg = 'reCAPTCHA verification failed. Please try again.';
      }
      toast.error(msg, { duration: 7000 });
    } finally {
      setSending(false)
    }
  }, [isEmail, targetValue])

  useEffect(() => {
    if (isOpen) {
      setTargetValue(value)
      setOtp('')
      setConfirmationResult(null)
      // Auto-trigger sending OTP on opening modal
      handleSendCode(value)
    }
  }, [isOpen, value, type, handleSendCode])

  // Countdown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleVerify = async (e) => {
    e?.preventDefault()
    const cleanOtp = otp.trim()
    if (!cleanOtp || cleanOtp.length !== 6) {
      toast.error('Please enter the 6-digit verification code')
      return
    }

    setLoading(true)
    try {
      let updatedUser

      if (isEmail) {
        // Verify Email OTP via Nodemailer backend
        const res = await verifyEmailOtp(targetValue.trim(), cleanOtp)
        updatedUser = res.data?.data?.user
      } else {
        // Verify Phone OTP via Firebase Phone Auth
        const firebaseUser = await verifyFirebasePhoneOtp(cleanOtp, confirmationResult)
        const idToken = await firebaseUser.getIdToken()

        // Sync verified phone to serveQ backend
        const res = await confirmFirebasePhone(targetValue.trim(), idToken)
        updatedUser = res.data?.data?.user
      }

      toast.success(
        `${isEmail ? 'Email' : 'Phone number'} verified successfully!`,
        {
          style: {
            borderRadius: '16px',
            background: '#ffffff',
            color: '#09090b',
            border: '1px solid #10b981',
          },
        }
      )

      if (onSuccess && updatedUser) {
        onSuccess(updatedUser)
      }
      onClose()
    } catch (err) {
      const msg = err.message || err.response?.data?.message || 'Invalid or expired verification code'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white border border-zinc-200/80 rounded-3xl shadow-2xl p-7 md:p-8 z-10 overflow-hidden"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-16 -right-16 w-44 h-44 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all active:scale-90"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100/80 flex items-center justify-center text-teal-600 shadow-xs">
              {isEmail ? <Mail className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-600">
                  {isEmail ? 'Nodemailer Security' : 'Firebase SMS Auth'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              </div>
              <h3 className="text-xl font-black text-zinc-950 tracking-tight">
                {isEmail ? 'Verify Email Terminal' : 'Verify Phone Number'}
              </h3>
            </div>
          </div>

          {/* Target Value Display / Input */}
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Destination {isEmail ? 'Address' : 'Mobile Number'}
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-black text-slate-900 break-all">
                {targetValue || '(Empty)'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                Pending OTP
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed border-t border-slate-200/60 pt-2 mt-2">
              {isEmail
                ? 'A 6-digit verification code has been dispatched to this email address via Nodemailer.'
                : 'An SMS with a 6-digit OTP code has been dispatched directly to your mobile phone via Firebase.'}
            </p>
          </div>

          {!isEmail && !isFirebaseConfigured && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Firebase config keys are missing in <code>.env</code>. Please provide <code>VITE_FIREBASE_API_KEY</code> to send cellular SMS.
              </span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-2">
                Enter 6-Digit OTP Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="w-full px-4 py-3.5 text-center tracking-[0.5em] font-mono text-2xl font-black rounded-2xl bg-slate-50 border border-zinc-200 text-zinc-950 placeholder-zinc-300 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-xs transition-all"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Resend & Expiry Info */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span className="text-[11px] font-medium">Valid for 5–10 mins</span>
              <button
                type="button"
                disabled={cooldown > 0 || sending}
                onClick={() => handleSendCode()}
                className="text-[11px] font-black text-teal-600 disabled:text-slate-400 hover:text-teal-700 transition-colors flex items-center gap-1 active:scale-95"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Sending SMS...</span>
                  </>
                ) : cooldown > 0 ? (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    <span>Resend in {cooldown}s</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    <span>Resend Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-2/3 py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-900 active:scale-95 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-zinc-900/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    <span>Verify & Confirm</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
