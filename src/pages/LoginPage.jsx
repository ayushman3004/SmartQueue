import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signup, signin } from '../api/auth.api'
import { toast } from 'react-hot-toast'
import { useSeo } from '../utils/useSeo'
import { isValidEmail, validatePasswordStrength } from '../utils/validators'
import ForgotPasswordModal from '../components/ForgotPasswordModal'

// Fluid Apple-style spring curve
const SLIDE_TRANSITION = {
  duration: 0.55,
  ease: [0.16, 1, 0.3, 1],
}

export default function LoginPage() {
  const [tab, setTab] = useState('signin') // 'signin' or 'signup'
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [ownerMismatch, setOwnerMismatch] = useState(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const { logIn } = useAuth()
  const navigate = useNavigate()

  useSeo({
    title: tab === 'signup' ? 'Create an Account' : 'Sign In',
    description: 'Sign in to serveQ to join queues, track estimated wait times, and manage bookings.',
    robots: 'index, follow',
    canonical: 'https://serveq.tech/login',
  })

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setOwnerMismatch(null)

    if (!isValidEmail(form.email)) {
      toast.error('Please enter a valid email address (e.g. name@example.com)')
      return
    }

    if (tab === 'signup') {
      const strength = validatePasswordStrength(form.password)
      if (!strength.isValid) {
        toast.error('Password must contain at least 8 characters, numbers, capital letters, and symbols.')
        return
      }
    }

    setLoading(true)
    try {
      const apiFn = tab === 'signup' ? signup : signin
      const payload = tab === 'signup'
        ? { name: form.name.trim(), email: form.email.trim(), password: form.password, role: 'customer' }
        : { email: form.email.trim(), password: form.password, requiredRole: 'customer' }

      const res = await apiFn(payload)
      const { user, token } = res.data.data

      if (user?.role === 'owner') {
        setOwnerMismatch({ email: form.email })
        toast.error('This account is registered as a Hub Owner, not a Customer.')
        return
      }

      logIn(user, token)
      toast.success(tab === 'signin' ? 'Welcome back! Logged in successfully.' : 'Welcome to serveQ! Account created.', {
        style: { borderRadius: '14px', background: '#ffffff', color: '#09090b', border: '1px solid #e4e4e7' }
      })
      navigate('/customers')
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to sign in. Please check your details.'
      if (
        (err.response?.status === 403 || err.response?.status === 409) &&
        (msg.toLowerCase().includes('hub owner') || msg.toLowerCase().includes('owner'))
      ) {
        setOwnerMismatch({ email: form.email })
      }
      toast.error(msg, {
        style: { borderRadius: '14px', background: '#ffffff', color: '#09090b', border: '1px solid #fee2e2' }
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = () => {
    localStorage.removeItem('auth_redirect')
    const apiUrl = import.meta.env.VITE_API_URL || ''
    window.location.href = `${apiUrl}/api/auth/google?role=customer`
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-10 auth-background relative overflow-hidden">
      {/* Background Soft Ambient Lights */}
      <div className="absolute -top-10 left-1/4 w-[480px] h-[480px] bg-emerald-400/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-10 right-1/4 w-[480px] h-[480px] bg-teal-400/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Split Card Container */}
      <div className="w-full max-w-4xl bg-white rounded-[32px] sm:rounded-[36px] shadow-2xl shadow-zinc-900/5 border border-zinc-200/80 overflow-hidden relative z-10">
        <div className="flex flex-col md:flex-row relative min-h-[560px] sm:min-h-[600px] w-full">
          {/* ─── 1. Cartoon Illustration Panel (Waving Boy & Girl) ─── */}
          <motion.div
            initial={false}
            animate={{
              x: isDesktop ? (tab === 'signup' ? '0%' : '100%') : '0%',
            }}
            transition={SLIDE_TRANSITION}
            className="w-full md:w-1/2 p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden min-h-[460px] sm:min-h-[600px] bg-[#dcf1e7] z-20"
          >
            {/* Full-Section Characters Image */}
            <img
              src="/welcome-characters.jpg"
              alt="Cartoon boy and girl welcoming to serveQ"
              className="absolute inset-0 w-full h-full object-cover object-bottom select-none pointer-events-none"
            />

            {/* Soft top gradient scrim to guarantee crisp text legibility */}
            <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#dcf1e7]/95 via-[#dcf1e7]/60 to-transparent pointer-events-none z-[1]" />

            {/* Top Logo */}
            <Link to="/" className="flex items-center gap-2.5 relative z-10 no-underline group" aria-label="serveQ Homepage">
              <img src="/serveq-logo.png" alt="serveQ Logo" className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105" />
            </Link>

            {/* Central Animated Greeting Title */}
            <div className="relative z-10 space-y-1.5 text-center sm:text-left mt-2 mb-auto">
              <AnimatePresence mode="wait">
                {tab === 'signup' ? (
                  <motion.div
                    key="text-signup"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                  >
                    <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight uppercase">
                      JOIN WITH US!
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-700 font-semibold max-w-xs mt-1">
                      Please add your information and create an account.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="text-signin"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                  >
                    <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight uppercase">
                      WELCOME BACK!
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-700 font-semibold max-w-xs mt-1">
                      Sign in to jump straight into your live queues and appointments.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Footer Text */}
            <div className="relative z-10 text-[11px] font-bold text-zinc-700/80 drop-shadow-xs mt-auto pt-6 text-center sm:text-left">
              Queue smart &bull; Skip waiting &bull; serveQ
            </div>
          </motion.div>

          {/* ─── 2. Auth Form Panel ─── */}
          <motion.div
            initial={false}
            animate={{
              x: isDesktop ? (tab === 'signup' ? '0%' : '-100%') : '0%',
            }}
            transition={SLIDE_TRANSITION}
            className="w-full md:w-1/2 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white z-10"
          >
            <div className="max-w-md w-full mx-auto space-y-6">
              {/* Form Heading */}
              <div className="space-y-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                      {tab === 'signup' ? 'Create an account' : 'Welcome back!'}
                    </h1>
                    <p className="text-xs text-zinc-500 font-medium mt-1">
                      {tab === 'signup'
                        ? 'Enter your details below to register your account.'
                        : 'Please enter your email and password to sign in.'}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Mismatch Alert for Hub Owner Accounts */}
              <AnimatePresence>
                {ownerMismatch && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2.5">
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-amber-700 text-sm">!</span>
                        <div>
                          <p className="font-bold text-amber-950">Hub Owner Account Detected</p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            This email is registered as a Hub Owner. Please log in via the Hub Owner Business Portal.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Link
                          to="/business"
                          className="flex-1 py-2 text-center rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs no-underline transition-all shadow-sm"
                        >
                          Go to Hub Owner Portal →
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                  {tab === 'signup' ? (
                    <motion.div
                      key="signup-inputs"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="space-y-4"
                    >
                      {/* Full Name */}
                      <div>
                        <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          name="name"
                          required
                          value={form.name}
                          onChange={onChange}
                          placeholder="John Doe"
                          autoComplete="name"
                          className="w-full px-4 py-3.5 rounded-2xl bg-zinc-100/80 border border-zinc-200/70 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          name="email"
                          required
                          value={form.email}
                          onChange={onChange}
                          placeholder="Enter your Email here"
                          autoComplete="email"
                          className="w-full px-4 py-3.5 rounded-2xl bg-zinc-100/80 border border-zinc-200/70 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            required
                            value={form.password}
                            onChange={onChange}
                            placeholder="Set a secure password"
                            autoComplete="new-password"
                            className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-zinc-100/80 border border-zinc-200/70 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors p-1"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? (
                              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* Red Color Password Guidelines */}
                        <div className="mt-2 p-3 hidden rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-1.5">
                          <p className="font-bold text-rose-600 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 shrink-0 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Password Requirements:
                          </p>
                          <p className="text-red-500 text-[11px] font-semibold leading-relaxed">
                            Password must contain numbers, capital letters, lowercase letters, and special symbols (minimum 8 characters).
                          </p>
                          <div className="grid grid-cols-2 gap-1 pt-0.5 text-[10px] font-bold">
                            <span className={form.password.length >= 8 ? 'text-emerald-600' : 'text-red-500'}>
                              {form.password.length >= 8 ? '✓' : '✗'} 8+ Characters
                            </span>
                            <span className={/[A-Z]/.test(form.password) ? 'text-emerald-600' : 'text-red-500'}>
                              {/[A-Z]/.test(form.password) ? '✓' : '✗'} Capital Letter (A-Z)
                            </span>
                            <span className={/[0-9]/.test(form.password) ? 'text-emerald-600' : 'text-red-500'}>
                              {/[0-9]/.test(form.password) ? '✓' : '✗'} Numbers (0-9)
                            </span>
                            <span className={/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(form.password) ? 'text-emerald-600' : 'text-red-500'}>
                              {/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(form.password) ? '✓' : '✗'} Special Symbols
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Primary Submit Button */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-6 rounded-2xl bg-[#52b788] hover:bg-[#40916c] active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 mt-2"
                      >
                        {loading ? 'Creating Account...' : 'Create Account'}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="signin-inputs"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="space-y-4"
                    >
                      {/* Email */}
                      <div>
                        <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          name="email"
                          required
                          value={form.email}
                          onChange={onChange}
                          placeholder="Enter your Email here"
                          autoComplete="email"
                          className="w-full px-4 py-3.5 rounded-2xl bg-zinc-100/80 border border-zinc-200/70 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-zinc-700 block">
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowForgotPassword(true)}
                            className="text-xs font-semibold text-[#FF5537] hover:text-[#d94126] transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            required
                            value={form.password}
                            onChange={onChange}
                            placeholder="Enter your Password"
                            autoComplete="current-password"
                            className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-zinc-100/80 border border-zinc-200/70 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors p-1"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? (
                              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Primary Submit Button */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-6 rounded-2xl bg-[#52b788] hover:bg-[#40916c] active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 mt-2"
                      >
                        {loading ? 'Signing In...' : 'Sign In'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>

              {/* Mode Toggle Link */}
              <div className="text-center text-xs font-medium text-zinc-500">
                {tab === 'signup' ? (
                  <p>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setTab('signin')}
                      className="font-bold text-[#2d6a4f] hover:text-[#1b4332] transition-colors underline active:scale-95"
                    >
                      Log in
                    </button>
                  </p>
                ) : (
                  <p>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setTab('signup')}
                      className="font-bold text-[#2d6a4f] hover:text-[#1b4332] transition-colors underline active:scale-95"
                    >
                      Create Account
                    </button>
                  </p>
                )}
              </div>

              {/* OR Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200" />
                </div>
                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
                  <span className="bg-white px-3 text-zinc-400">OR</span>
                </div>
              </div>

              {/* Google Login Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                className="w-full py-3.5 px-4 rounded-2xl bg-white border border-zinc-200/90 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-700 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Business / Hub Owner Link */}
              <div className="pt-2 text-center">
                <Link
                  to="/business"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 transition-colors"
                >
                  <span>Business / Hub Owner Portal</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        initialEmail={form.email}
      />
    </div>
  )
}
