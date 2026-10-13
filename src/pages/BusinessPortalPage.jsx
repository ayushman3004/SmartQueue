import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signup, signin, upgradeToOwner } from '../api/auth.api'
import { toast } from 'react-hot-toast'
import HubCommandCenter from '../components/HubCommandCenter'
import { useSeo } from '../utils/useSeo'
import { CATEGORY_METADATA } from '../utils/servicePresets'
import { isValidEmail, validatePasswordStrength } from '../utils/validators'

// Fluid Apple-style spring curve
const SLIDE_TRANSITION = {
  duration: 0.55,
  ease: [0.16, 1, 0.3, 1],
}

export default function BusinessPortalPage() {
  const { user, logIn, logOut, setUser } = useAuth()
  const navigate = useNavigate()

  useSeo({
    title: 'Business Hub Portal — Virtual Queues & Counter Control',
    description: 'Enterprise virtual queue management for salons, clinics, and service venues. Command customer flow and eliminate physical waiting lines.',
    robots: 'index, follow',
    canonical: 'https://serveq.tech/business',
  })

  // Responsive desktop detection for smooth coordinate slide
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auth form states
  const [authTab, setAuthTab] = useState('signin') // 'signin' or 'signup'
  const [form, setForm] = useState({ name: '', businessName: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Role mismatch state for customers attempting to log in
  const [customerMismatch, setCustomerMismatch] = useState(null)
  const [upgrading, setUpgrading] = useState(false)

  const isOwnerOrAdmin = user && (user.role === 'owner' || user.role === 'admin')
  const isCustomer = user && user.role === 'customer'

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setCustomerMismatch(null)

    if (!isValidEmail(form.email)) {
      toast.error('Please enter a valid work email address (e.g. owner@venue.com)')
      return
    }

    if (authTab === 'signup') {
      const strength = validatePasswordStrength(form.password)
      if (!strength.isValid) {
        toast.error('Password must contain at least 8 characters, numbers, capital letters, and symbols.')
        return
      }
    }

    setLoading(true)
    try {
      if (authTab === 'signup') {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: 'owner', // Strictly Hub Owner
        }
        const res = await signup(payload)
        const { user: newUser, token } = res.data.data
        logIn(newUser, token)
        toast.success('Hub Owner account registered successfully! Let’s set up your venue...', {
          style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #14b8a6' },
        })
        navigate('/business/onboarding')
        return
      } else {
        const payload = {
          email: form.email.trim(),
          password: form.password,
          requiredRole: 'owner', // Enforce Hub Owner role check
        }
        const res = await signin(payload)
        const { user: authUser, token } = res.data.data
        if (authUser.role !== 'owner' && authUser.role !== 'admin') {
          setCustomerMismatch({ user: authUser, token })
          toast.error('This account is registered as a Customer, not a Hub Owner.')
          return
        }
        logIn(authUser, token)
        toast.success(`Welcome back, ${authUser.name}!`, {
          style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #14b8a6' },
        })
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Authentication failed'
      if (
        (err.response?.status === 403 || err.response?.status === 409) &&
        msg.toLowerCase().includes('customer')
      ) {
        setCustomerMismatch({ email: form.email })
      }
      toast.error(msg, {
        style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #fecdd3' },
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = () => {
    localStorage.setItem('auth_redirect', '/business')
    const apiUrl = import.meta.env.VITE_API_URL || ''
    window.location.href = `${apiUrl}/api/auth/google?role=owner`
  }

  const handleUpgradeCurrentAccount = async () => {
    setUpgrading(true)
    try {
      const res = await upgradeToOwner()
      const updatedUser = res.data.data.user
      setUser(updatedUser)
      setCustomerMismatch(null)
      toast.success('Your account is now upgraded to Hub Owner!', {
        style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #14b8a6' },
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upgrade account')
    } finally {
      setUpgrading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: Authenticated as Customer Gate
  // ─────────────────────────────────────────────────────────────
  if (isCustomer) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] text-zinc-900 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-teal-400/10 blur-[140px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-white border border-zinc-200 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto shadow-sm text-amber-800">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              Customer Account Detected
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              Hub Owner Access Only
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed max-w-md mx-auto">
              You are currently signed in as <span className="text-zinc-900 font-bold">{user.email}</span> with a customer account. The <span className="text-teal-700 font-bold">serveq.tech/business</span> portal is exclusively reserved for Business & Hub Owners.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              disabled={upgrading}
              onClick={handleUpgradeCurrentAccount}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#52b788] hover:bg-[#40916c] text-white font-bold text-xs uppercase tracking-wider shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>{upgrading ? 'Upgrading Account...' : 'Upgrade Account to Hub Owner'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full py-3.5 px-6 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs uppercase tracking-wider transition-all"
            >
              ← Return to Customer Dashboard
            </button>

            <button
              type="button"
              onClick={() => { logOut(); navigate('/business') }}
              className="text-[11px] font-bold text-zinc-400 hover:text-rose-600 transition-colors uppercase tracking-wider block mx-auto pt-2"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: Authenticated as Hub Owner / Admin (Full Console)
  // ─────────────────────────────────────────────────────────────
  if (isOwnerOrAdmin) {
    return <HubCommandCenter />
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: Unauthenticated Hub Owner Portal (serveq.tech/business)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f4f7f6] text-zinc-900 relative overflow-x-hidden flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8">
      {/* Background Soft Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-teal-400/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-emerald-400/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Top Header */}
      <header className="max-w-5xl mx-auto w-full mb-6">
        <div className="flex items-center justify-between py-2">
          <Link to="/" className="flex items-center gap-2.5 no-underline group">
            <div className="w-9 h-9 rounded-2xl bg-zinc-950 text-white flex items-center justify-center font-black text-sm shadow-sm group-hover:scale-105 transition-transform">
              Q
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-zinc-950 leading-none">serveQ</span>
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  Business
                </span>
              </div>
              <span className="text-[10px] font-bold text-zinc-500">
                Hub Owner Portal
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-text text-xs text-zinc-500 font-medium">
              Looking to join a queue as a customer?
            </span>
            <Link
              to="/login"
              className="text-xs font-bold px-4 py-2 rounded-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-zinc-950 transition-all no-underline shadow-xs"
            >
              Customer Portal →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Split Card */}
      <main className="max-w-5xl mx-auto w-full space-y-12 my-auto">
        <div className="w-full bg-white rounded-[32px] sm:rounded-[36px] shadow-2xl shadow-zinc-900/5 border border-zinc-200/80 overflow-hidden relative z-10">
          <div className="flex flex-col md:flex-row relative min-h-[580px] sm:min-h-[620px] w-full">
            {/* ─── 1. Business Illustration Panel (Venue Manager & Clinic Owner) ─── */}
            <motion.div
              initial={false}
              animate={{
                x: isDesktop ? (authTab === 'signup' ? '0%' : '100%') : '0%',
              }}
              transition={SLIDE_TRANSITION}
              className="w-full md:w-1/2 p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden min-h-[460px] sm:min-h-[620px] bg-[#dcf1e7] z-20"
            >
              {/* Full-Section Business Characters Image */}
              <img
                src="/business-characters.jpg"
                alt="Business owners welcoming you to serveQ"
                className="absolute inset-0 w-full h-full object-cover object-bottom select-none pointer-events-none"
              />

              {/* Soft top gradient scrim for crisp text legibility */}
              <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#dcf1e7]/95 via-[#dcf1e7]/60 to-transparent pointer-events-none z-[1]" />

              {/* Top Logo */}
              <Link to="/" className="flex items-center gap-2.5 relative z-10 no-underline group" aria-label="serveQ Homepage">
                <div className="w-8 h-8 rounded-xl bg-zinc-950 text-white flex items-center justify-center text-xs font-black shadow-sm group-hover:scale-105 transition-transform">
                  Q
                </div>
                <span className="text-base font-black tracking-tight text-zinc-900 drop-shadow-xs">serveQ Business</span>
              </Link>

              {/* Central Animated Greeting Title */}
              <div className="relative z-10 space-y-1.5 text-center sm:text-left mt-2 mb-auto">
                <AnimatePresence mode="wait">
                  {authTab === 'signup' ? (
                    <motion.div
                      key="biz-signup-header"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight uppercase">
                        REGISTER YOUR VENUE!
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-700 font-semibold max-w-xs mt-1">
                        Eliminate physical lines. Command live venue flow.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="biz-signin-header"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight uppercase">
                        COMMAND CENTER LOGIN
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-700 font-semibold max-w-xs mt-1">
                        Access live counters, queues, and appointments across all your devices.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Footer Text */}
              <div className="relative z-10 text-[11px] font-bold text-zinc-700/80 drop-shadow-xs mt-auto pt-6 text-center sm:text-left">
                Salons &bull; Clinics &bull; Dining &bull; Retail &bull; Banking
              </div>
            </motion.div>

            {/* ─── 2. Auth Form Panel ─── */}
            <motion.div
              initial={false}
              animate={{
                x: isDesktop ? (authTab === 'signup' ? '0%' : '-100%') : '0%',
              }}
              transition={SLIDE_TRANSITION}
              className="w-full md:w-1/2 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white z-10"
            >
              <div className="max-w-md w-full mx-auto space-y-5">
                {/* Form Heading */}
                <div className="space-y-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={authTab}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                        {authTab === 'signup' ? 'Hub Owner Registration' : 'Hub Owner Sign In'}
                      </h1>
                      <p className="text-xs text-zinc-500 font-medium mt-1">
                        {authTab === 'signup'
                          ? 'Deploy your venue operational hub on serveQ in seconds.'
                          : 'Access your venue queues and operations terminal.'}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Mismatch Alert for Customer Accounts */}
                <AnimatePresence>
                  {customerMismatch && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2.5">
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-amber-700 text-sm">!</span>
                          <div>
                            <p className="font-bold text-amber-950">Hub Owner Account Required</p>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              This email is currently registered as a Customer. Upgrade your account or switch to the Customer Portal.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          {user && (
                            <button
                              type="button"
                              onClick={handleUpgradeCurrentAccount}
                              disabled={upgrading}
                              className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                            >
                              {upgrading ? 'Upgrading...' : 'Upgrade to Hub Owner'}
                            </button>
                          )}
                          <Link
                            to="/login"
                            className="flex-1 py-2 text-center rounded-xl bg-white border border-amber-300 text-amber-950 font-bold text-xs no-underline"
                          >
                            Customer Portal →
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form Fields */}
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <AnimatePresence mode="wait">
                    {authTab === 'signup' ? (
                      <motion.div
                        key="biz-signup-inputs"
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
                            placeholder="Alex Morgan"
                            autoComplete="name"
                            className="w-full px-4 py-3.5 rounded-2xl bg-zinc-100/80 border border-zinc-200/70 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                          />
                        </div>

                        {/* Work Email */}
                        <div>
                          <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                            Work Email Address
                          </label>
                          <input
                            type="email"
                            name="email"
                            required
                            value={form.email}
                            onChange={onChange}
                            placeholder="owner@yourvenue.com"
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
                              placeholder="At least 6 characters"
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
                          <div className="mt-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-1.5">
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

                        {/* Assigned Role Pill */}
                        <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center justify-between text-xs">
                          <span className="text-zinc-600 font-medium">Assigned Operational Role:</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-teal-600 text-white font-black text-[10px] uppercase tracking-wider">
                            Hub Owner
                          </span>
                        </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-3.5 px-6 rounded-2xl bg-[#52b788] hover:bg-[#40916c] active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 mt-2"
                        >
                          {loading ? 'Registering Venue...' : 'Register as Hub Owner'}
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="biz-signin-inputs"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="space-y-4"
                      >
                        {/* Work Email */}
                        <div>
                          <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                            Work Email Address
                          </label>
                          <input
                            type="email"
                            name="email"
                            required
                            value={form.email}
                            onChange={onChange}
                            placeholder="owner@yourvenue.com"
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

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-3.5 px-6 rounded-2xl bg-[#52b788] hover:bg-[#40916c] active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 mt-2"
                        >
                          {loading ? 'Authenticating...' : 'Sign In to Hub Console'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>

                {/* Mode Toggle Link */}
                <div className="text-center text-xs font-medium text-zinc-500">
                  {authTab === 'signup' ? (
                    <p>
                      Already registered as a Hub Owner?{' '}
                      <button
                        type="button"
                        onClick={() => { setAuthTab('signin'); setCustomerMismatch(null) }}
                        className="font-bold text-[#2d6a4f] hover:text-[#1b4332] transition-colors underline active:scale-95"
                      >
                        Log in
                      </button>
                    </p>
                  ) : (
                    <p>
                      New business, salon, or clinic?{' '}
                      <button
                        type="button"
                        onClick={() => { setAuthTab('signup'); setCustomerMismatch(null) }}
                        className="font-bold text-[#2d6a4f] hover:text-[#1b4332] transition-colors underline active:scale-95"
                      >
                        Register as Hub Owner
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
                  <span>Continue with Google (Hub Owner)</span>
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ─── 3. Business Value Proposition & Feature Cards (Preserved Description) ─── */}
        <section className="space-y-6 pt-4 text-center sm:text-left">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-[10px] font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              Enterprise Operational Infrastructure
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
              Eliminate physical lines. Command live venue flow.
            </h2>
            <p className="text-sm text-zinc-600 font-medium leading-relaxed">
              Engineered for restaurants, clinics, salons, banking branches, and high-volume retail. Sign up or log in above to deploy your hub.
            </p>
          </div>

          {/* 4 Feature Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 text-left">
            <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-2 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Sub-10ms Live Counters</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Call next tickets, auto-alert customers when their turn approaches, and sync across all devices in real-time.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-2 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-zinc-900">AI Wait Predictions</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Heuristic AI wait estimations minimize walkouts and calibrate customer arrival with counter velocity.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-2 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Instant In-App Deposits</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Collect reservation deposits or session fees upfront via in-app wallet balances, slashing no-show rates.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-2 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Service Catalog Matrix</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Configure custom session durations, pricing tiers, and technician availability per counter on demand.
              </p>
            </div>
          </div>

          {/* Supported Venue Tags */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mr-1">
              Supported Venues:
            </span>
            {['Dining & Cafes', 'Medical Clinics', 'Salons & Spas', 'Banking Centers', 'Retail Boutiques'].map((t) => (
              <span
                key={t}
                className="px-3 py-1 rounded-full bg-white border border-zinc-200 text-zinc-700 text-xs font-semibold shadow-xs"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full pt-8 mt-10 border-t border-zinc-200 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          &copy; {new Date().getFullYear()} serveQ Infrastructure. Enterprise Venue Command.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5">
          <Link to="/" className="text-zinc-600 hover:text-zinc-900 transition-colors no-underline font-medium">
            Customer Home
          </Link>
          <Link to="/login" className="text-zinc-600 hover:text-zinc-900 transition-colors no-underline font-medium">
            Customer Portal
          </Link>
          <Link to="/privacy" className="text-zinc-600 hover:text-zinc-900 transition-colors no-underline font-medium">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-zinc-600 hover:text-zinc-900 transition-colors no-underline font-medium">
            Terms & Conditions
          </Link>
          <span className="text-teal-700 font-mono text-[11px] font-bold">serveq.tech/business</span>
        </div>
      </footer>
    </div>
  )
}
