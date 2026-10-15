import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { forgotPasswordSendOtp, forgotPasswordVerifyOtp, forgotPasswordReset } from '../api/auth.api'
import { isValidEmail, validatePasswordStrength } from '../utils/validators'

export default function ForgotPasswordModal({ isOpen, onClose, initialEmail = '' }) {
  // Steps: 'email' (1) -> 'otp' (2) -> 'password' (3) -> 'success' (4)
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail || '')
      setStep('email')
      setOtp('')
      setResetToken('')
      setNewPassword('')
      setConfirmPassword('')
      setLoading(false)
    }
  }, [isOpen, initialEmail])

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  if (!isOpen) return null

  // Step 1: Send OTP
  const handleSendOtp = async (e) => {
    e?.preventDefault()
    if (cooldown > 0) return
    const trimmedEmail = email.trim()
    if (!isValidEmail(trimmedEmail)) {
      toast.error('Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      const res = await forgotPasswordSendOtp(trimmedEmail)
      toast.success('Verification code sent to your email!', {
        style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #14b8a6' },
      })
      setStep('otp')
      setCooldown(30)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send verification code'
      if (err.response?.status === 429) {
        const match = msg.match(/(\d+)\s*sec/i)
        const seconds = match ? parseInt(match[1], 10) : (err.response?.data?.retryAfterSeconds || 30)
        setCooldown(seconds)
      }
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault()
    const cleanOtp = otp.trim()
    if (!cleanOtp || cleanOtp.length !== 6) {
      toast.error('Please enter the 6-digit verification code')
      return
    }

    setLoading(true)
    try {
      const res = await forgotPasswordVerifyOtp(email.trim(), cleanOtp)
      const token = res.data?.data?.resetToken
      setResetToken(token)
      toast.success('Code verified! Set your new password.', {
        style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #14b8a6' },
      })
      setStep('password')
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid or expired verification code'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e?.preventDefault()
    const strength = validatePasswordStrength(newPassword)
    if (!strength.isValid) {
      toast.error('Password must contain at least 8 characters, numbers, capital letters, and symbols.')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await forgotPasswordReset({
        email: email.trim(),
        resetToken,
        otp: otp.trim(),
        newPassword,
      })
      toast.success('Password updated successfully!', {
        style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #14b8a6' },
      })
      setStep('success')
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-200/80 z-10 overflow-hidden"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#FF5537] to-[#FA5032]" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center transition-colors"
          aria-label="Close modal"
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/70 flex items-center justify-center p-1.5 shadow-xs">
            <img src="/logo.png?v=2" alt="serveQ" className="w-full h-full object-contain" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-zinc-950 leading-none">
              Reset Password
            </h3>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              serve<span className="text-[#FF5537]">Q</span> Security
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Enter Email */}
          {step === 'email' && (
            <motion.form
              key="step-email"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleSendOtp}
              className="space-y-4"
            >
              <p className="text-xs text-zinc-600 leading-relaxed">
                Enter your account email. We will send a 6-digit one-time passcode (OTP) to verify your identity.
              </p>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                  Account Email
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:bg-white focus:border-[#FF5537] focus:ring-2 focus:ring-[#FF5537]/20 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || cooldown > 0}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#FF5537] hover:bg-[#e04529] active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Sending Code...' : cooldown > 0 ? `Wait ${cooldown}s before resending` : 'Send Verification Code'}
              </button>

              {cooldown > 0 && (
                <p className="text-[11px] text-amber-600 font-semibold text-center">
                  Verification code recently requested. Please check your inbox or wait {cooldown}s.
                </p>
              )}
            </motion.form>
          )}

          {/* STEP 2: Enter OTP */}
          {step === 'otp' && (
            <motion.form
              key="step-otp"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleVerifyOtp}
              className="space-y-4"
            >
              <div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  We sent a 6-digit verification code to:
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-black text-zinc-900 break-all">{email}</span>
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="text-[11px] font-bold text-[#FF5537] hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="w-full px-4 py-3 text-center tracking-[0.4em] font-mono text-2xl font-black rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-300 focus:outline-none focus:bg-white focus:border-[#FF5537] focus:ring-2 focus:ring-[#FF5537]/20 transition-all"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
                <span>Code valid for 10 minutes</span>
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={handleSendOtp}
                  className="font-bold text-[#FF5537] disabled:text-zinc-400 hover:underline"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#FF5537] hover:bg-[#e04529] active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </motion.form>
          )}

          {/* STEP 3: Enter New Password */}
          {step === 'password' && (
            <motion.form
              key="step-password"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleResetPassword}
              className="space-y-4"
            >
              <p className="text-xs text-zinc-600 leading-relaxed">
                Code verified. Choose a strong new password for your account.
              </p>

              {/* New Password */}
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:bg-white focus:border-[#FF5537] focus:ring-2 focus:ring-[#FF5537]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-4 py-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:bg-white focus:border-[#FF5537] focus:ring-2 focus:ring-[#FF5537]/20 transition-all"
                />
              </div>

              {/* Password Guidelines */}
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <p className="font-bold">Password Requirements:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                  <li>At least 8 characters</li>
                  <li>At least one capital letter (A-Z)</li>
                  <li>At least one number (0-9)</li>
                  <li>At least one special symbol (!@#$%^&*...)</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#FF5537] hover:bg-[#e04529] active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Updating Password...' : 'Reset Password'}
              </button>
            </motion.form>
          )}

          {/* STEP 4: Success */}
          {step === 'success' && (
            <motion.div
              key="step-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4 space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto shadow-inner">
                ✓
              </div>
              <div>
                <h4 className="text-base font-black text-zinc-950">Password Reset Successful!</h4>
                <p className="text-xs text-zinc-600 mt-1">
                  Your password has been securely updated. You can now log in with your new credentials.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 px-6 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-sm transition-all"
              >
                Return to Sign In
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
