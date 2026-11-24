import './ProfilePage.css'
import Prescriptions from '../components/Prescriptions'
import { usePrescriptions } from '../hooks/usePrescriptions'
import { normalizePhoneNumber } from '../utils/phoneNumbers'
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { PageNotificationStatus } from '../modules/notification/NotificationStatus'
import NotificationCenter from '../components/NotificationCenter'
import { useNotificationFeedback } from '../modules/notification/useNotificationFeedback'
import {
  CheckCircle2,
  Mail,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Building2,
  UserCheck,
  ShieldAlert,
  Calendar,
  Ticket,
  ArrowRight,
  ExternalLink,
  Lock,
  Edit3,
  Check,
  X,
  RefreshCw,
  Loader2,
  Sparkles,
  ChevronLeft,
  LogOut,
  MapPin,
  Clock,
  KeyRound,
  Store,
  Menu,
  Home,
  Upload,
} from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useSeo } from '../utils/useSeo'
import { isValidEmail } from '../utils/validators'
import { sendEmailOtp, verifyEmailOtp } from '../api/auth.api'
import VerifyContactModal from '../components/VerifyContactModal'
import ForgotPasswordModal from '../components/ForgotPasswordModal'
import CustomerSidebar from '../components/CustomerSidebar'
import { prepareAvatar } from '../utils/avatarUpload'

const profileValues = user => ({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', bio: user?.bio || '', location: user?.location || '', avatar: user?.avatar || '', whatsappFollowUpOptIn: Boolean(user?.whatsappFollowUpOptIn) })

export default function ProfilePage() {
  const feedback = useNotificationFeedback()
  const { user, setUser, logOut } = useAuth()
  const navigate = useNavigate()
  const prescriptions = usePrescriptions(user?.role === 'customer' ? user._id : null)

  useSeo({
    title: 'Profile & Account Security — serveQ',
    description: 'Manage your serveQ profile, verify your contact details, and configure role settings.',
    robots: 'noindex, nofollow',
  })

  // Edit profile state
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [processingAvatar, setProcessingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  // Mobile drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Phone modal
  const [phoneModalOpen, setPhoneModalOpen] = useState(false)

  // Inline Email Verification State
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtp, setEmailOtp] = useState('')
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false)
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)

  // Form data
  const [form, setForm] = useState(() => profileValues(user))

  useEffect(() => {
    if (user) setForm(profileValues(user))
  }, [user])

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    if (otpCooldown <= 0) return
    const timer = setInterval(() => {
      setOtpCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [otpCooldown])

  // Email verification status
  const isEmailVerified = Boolean(
    user?.isEmailVerified && form.email?.toLowerCase().trim() === user?.email?.toLowerCase().trim()
  )
  const isPhoneVerified = Boolean(
    user?.isPhoneVerified && form.phone && normalizePhoneNumber(form.phone) === normalizePhoneNumber(user.phone)
  )

  const role = user?.role || 'customer'
  const isOwner = role === 'owner'
  const isAdmin = role === 'admin'
  const isCustomer = role === 'customer'

  // Back navigation path based on role
  const backPath = useMemo(() => {
    if (isOwner) return '/business'
    if (isAdmin) return '/admin'
    return '/customers'
  }, [isOwner, isAdmin])

  // Send Email OTP Handler
  const handleSendEmailOtp = async (customEmail) => {
    const targetEmail = (customEmail || form.email || user?.email || '').trim()
    if (!targetEmail || !isValidEmail(targetEmail)) {
      feedback.error('Please enter a valid email address (e.g. name@domain.com)')
      return
    }

    setSendingEmailOtp(true)
    try {
      const res = await sendEmailOtp(targetEmail)
      setEmailOtpSent(true)
      setOtpCooldown(30)
      feedback.success(res.data?.message || `Verification code sent to ${targetEmail}`)
    } catch (err) {
      feedback.error(err.response?.data?.message || 'Failed to send email verification OTP')
    } finally {
      setSendingEmailOtp(false)
    }
  }

  // Verify Email OTP Handler
  const handleVerifyEmailOtp = async (e) => {
    e?.preventDefault()
    if (processingAvatar || saving) return
    const targetEmail = (form.email || user?.email || '').trim()
    const code = emailOtp.trim()

    if (!code || code.length < 6) {
      feedback.error('Please enter the complete 6-digit OTP code')
      return
    }

    setVerifyingEmailOtp(true)
    try {
      const res = await verifyEmailOtp(targetEmail, code)
      if (res.data?.success || res.data?.data?.user) {
        const updated = res.data.data.user || { ...user, isEmailVerified: true, email: targetEmail }
        setUser(updated)
        setForm((prev) => ({ ...prev, email: updated.email }))
        setEmailOtpSent(false)
        setEmailOtp('')
        feedback.success('Email address verified successfully!')
      }
    } catch (err) {
      feedback.error(err.response?.data?.message || 'Invalid or expired OTP code')
    } finally {
      setVerifyingEmailOtp(false)
    }
  }

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAvatarError('')
    setProcessingAvatar(true)
    try {
      const avatar = await prepareAvatar(file)
      setForm((prev) => ({ ...prev, avatar }))
      setEditing(true)
    } catch (error) {
      setAvatarError(error.message || 'Unable to load this photo.')
    } finally {
      setProcessingAvatar(false)
    }
  }

  // Save Profile Details
  const handleSaveProfile = async (e) => {
    e?.preventDefault()
    if (form.email && !isValidEmail(form.email.trim())) {
      feedback.error('Please provide a valid email format')
      return
    }

    setSaving(true)
    try {
      const res = await api.patch('/auth/me', form)
      if (res.data.success) {
        setUser(res.data.data.user)
        feedback.success('Profile updated successfully!')
        setEditing(false)
      }
    } catch (err) {
      feedback.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  // Upgrade Account to Hub Owner (for customers)
  return (
    <div className="profile-page customer-tab min-h-screen app-background-glow text-[#153c2b] flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900 relative">
      {/* ── TOP HEADER BAR ── */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-xl text-[#52675b] hover:text-[#153c2b] hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to={backPath} className="flex items-center group text-decoration-none">
            <img src="/serveq-logo.png" alt="serveQ" className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105" />
          </Link>
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-zinc-200">
            <span className="text-xs font-semibold text-[#52675b]">Profile & Security</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <NotificationCenter />
          <span
            className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              isAdmin
                ? 'bg-[#e6f0e8] text-[#315b45] border-[#c1d5c7]'
                : isOwner
                ? 'bg-[#EAF7EE] text-[#114227] border-[#BDE8CB]'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {role.toUpperCase()}
          </span>

          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="text-xs font-bold text-zinc-800 hover:text-[#153c2b] bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 pl-2 pr-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95"
            title="Return to Home Dashboard"
          >
            <span className="w-6 h-6 rounded-lg icon-3d icon-3d-emerald shrink-0">
              <Home className="w-3.5 h-3.5" />
            </span>
            <span>Home</span>
          </button>
        </div>
      </header>
      <PageNotificationStatus belowHeader />

      {/* ── BODY: SIDEBAR + MAIN CANVAS ── */}
      <div className="flex-1 flex w-full">
        {/* SIDEBAR (DESKTOP + ANIMATED MOBILE DRAWER) */}
        <CustomerSidebar
          activeNavTab="profile"
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* MAIN CANVAS */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pb-20">
        {/* ── HERO IDENTITY CARD ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="customer-surface bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden"
        >
          {/* Decorative ambient gradient backdrop */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            {/* Avatar & User Details */}
            <div className="profile-identity flex items-center gap-5">
              <div className="relative group shrink-0">
                {form.avatar ? (
                  <img
                    src={form.avatar}
                    alt={user?.name || 'User Avatar'}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-[#BDE8CB] shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#114227] text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-sm">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                {isEmailVerified && (
                  <div
                    title="Email Verified"
                    className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-[#153c2b] tracking-tight">
                    {user?.name || 'ServeQ Member'}
                  </h1>
                  {isAdmin && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#e6f0e8] text-[#315b45] border border-[#c1d5c7] flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-[#315b45]" />
                      Root Admin
                    </span>
                  )}
                  {isOwner && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EAF7EE] text-[#114227] border border-[#BDE8CB] flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-[#114227]" />
                      Hub Owner
                    </span>
                  )}
                  {isCustomer && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-emerald-700" />
                      Customer
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-[#52675b] font-medium">
                  {user?.email}
                </p>

                {user?.location && (
                  <div className="flex items-center gap-1 pt-1 text-[11px] text-[#617168] font-medium">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                    {user.location}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions (Edit Button) */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <button
                type="button"
                disabled={saving || processingAvatar}
                onClick={() => {
                  if (editing) {
                    setForm(profileValues(user))
                    setAvatarError('')
                    setEmailOtpSent(false)
                    setEmailOtp('')
                  }
                  setEditing(prev => !prev)
                }}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  editing
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    : 'profile-primary bg-[#315b45] hover:bg-[#254a36] text-white shadow-xs'
                }`}
              >
                {editing ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel Editing</span>
                  </>
                ) : (
                  <>
                    <span className="w-6 h-6 rounded-lg icon-3d icon-3d-emerald shrink-0">
                      <Edit3 className="w-3.5 h-3.5" />
                    </span>
                    <span>Edit Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── PRIORITY: EMAIL VERIFICATION WITH OTP BANNER ── */}
        {!isEmailVerified && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 sm:p-6 rounded-3xl bg-[#faf4ef] border border-[#dfcbbd] shadow-xs relative overflow-hidden text-left space-y-4"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#f3e9e1] border border-[#dfcbbd] text-[#765546] flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-[#765546]" />
                </div>
                <div>
                  <div className="profile-contact-field flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#f3e9e1] text-[#765546] border border-[#dfcbbd]">
                      Action Required
                    </span>
                    <h3 className="text-base font-black text-[#153c2b]">
                      Email Address Not Verified
                    </h3>
                  </div>
                  <p className="text-xs text-[#52675b] font-medium mt-1 leading-relaxed max-w-2xl">
                    Your account email <span className="font-bold text-[#153c2b]">{form.email || user?.email}</span> is currently unverified. Verify with a 6-digit OTP to enable queue pass receipts, booking alerts, and account recovery.
                  </p>
                </div>
              </div>

              {!emailOtpSent && (
                <button
                  type="button"
                  disabled={sendingEmailOtp}
                  onClick={() => handleSendEmailOtp()}
                  className="px-5 py-2.5 rounded-full profile-primary bg-[#315b45] hover:bg-[#254a36] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  {sendingEmailOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send Verification OTP</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Inline OTP Input Section (Appears after code is sent) */}
            {emailOtpSent && (
              <form
                onSubmit={handleVerifyEmailOtp}
                className="pt-3 border-t border-[#dfcbbd] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#faf4ef] p-4 rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-[#765546] block">
                      Enter 6-Digit Passcode
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      inputMode="numeric" autoComplete="one-time-code"
                      autoFocus
                      placeholder="• • • • • •"
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-44 px-3.5 py-2 text-center text-lg font-black tracking-widest bg-white border border-[#dfcbbd] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#315b45] text-[#153c2b] shadow-2xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={verifyingEmailOtp || emailOtp.length < 6}
                    className="mt-4 px-5 py-2.5 rounded-xl profile-primary bg-[#315b45] hover:bg-[#254a36] disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {verifyingEmailOtp ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm OTP</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {otpCooldown > 0 ? (
                    <span className="text-[#617168] font-semibold text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#765546]" />
                      Resend code in {otpCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={sendingEmailOtp}
                      onClick={() => handleSendEmailOtp()}
                      className="text-[#765546] hover:text-[#614437] font-bold underline text-xs cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Resend OTP</span>
                    </button>
                  )}
                </div>
              </form>
            )}
          </motion.div>
        )}

        {/* ── MAIN CONTENT GRID (FORM + ROLE HIGHLIGHTS) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
          {/* LEFT 2 COLUMNS: CORE PROFILE INFORMATION */}
          <div className="lg:col-span-2 space-y-6">
            <div className="customer-surface bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div className="space-y-0.5">
                  <h3 className="text-lg font-black text-[#153c2b] tracking-tight">
                    Account Credentials
                  </h3>
                  <p className="text-xs text-[#617168] font-medium">
                    Personal and contact details linked to your serveQ node.
                  </p>
                </div>
                {editing && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Editing Enabled
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#617168]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    readOnly={!editing}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter your name"
                    className={`w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                      editing
                        ? 'bg-white border border-zinc-300 focus:outline-none focus:border-[#114227] focus:ring-1 focus:ring-[#114227]'
                        : 'bg-zinc-50 border border-zinc-100 text-zinc-800 cursor-default'
                    }`}
                  />
                </div>

                {/* Email Address with Verification Pill & Quick OTP Button */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#617168]">
                      Email Terminal
                    </label>
                    {isEmailVerified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
                        <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#faf4ef] text-[#765546] border border-[#dfcbbd]">
                        <AlertCircle className="w-3 h-3 text-[#765546]" />
                        Unverified
                      </span>
                    )}
                  </div>

                  <div className="profile-contact-field flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="email"
                        readOnly={!editing}
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="your-name@domain.com"
                        className={`w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                          editing
                            ? 'bg-white border border-zinc-300 focus:outline-none focus:border-[#114227]'
                            : 'bg-zinc-50 border border-zinc-100 text-zinc-800 cursor-default'
                        }`}
                      />
                    </div>

                    {!isEmailVerified && (
                      <button
                        type="button"
                        disabled={sendingEmailOtp}
                        onClick={() => handleSendEmailOtp()}
                        className="px-4 py-3 rounded-2xl profile-primary bg-[#315b45] hover:bg-[#254a36] text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Verify OTP</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Phone Number with Verification */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#617168]">
                      Mobile Number (SMS Alerts)
                    </label>
                    {isPhoneVerified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
                        <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-[#52675b] border border-zinc-200">
                        Optional
                      </span>
                    )}
                  </div>

                  <div className="profile-contact-field flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="tel"
                        readOnly={!editing}
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value, whatsappFollowUpOptIn: false })}
                        placeholder="+91 98765 43210"
                        className={`w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                          editing
                            ? 'bg-white border border-zinc-300 focus:outline-none focus:border-[#114227]'
                            : 'bg-zinc-50 border border-zinc-100 text-zinc-800 cursor-default'
                        }`}
                      />
                    </div>

                    {form.phone && !isPhoneVerified && (
                      <button
                        type="button"
                        onClick={() => setPhoneModalOpen(true)}
                        className="px-4 py-3 rounded-2xl profile-primary bg-[#315b45] hover:bg-[#254a36] text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Verify Phone</span>
                      </button>
                    )}
                  </div>
                </div>

                {isCustomer && <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={form.whatsappFollowUpOptIn} disabled={!editing || !isPhoneVerified}
                      onChange={(event) => setForm({ ...form, whatsappFollowUpOptIn: event.target.checked })} />
                    Receive follow-up reminders on WhatsApp
                  </label>
                  <p className="text-xs text-zinc-600">{isPhoneVerified ? 'Reminders go to your verified number.' : 'Verify your phone number to enable WhatsApp reminders.'}</p>
                </div>}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Location */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#617168]">
                      City / Location
                    </label>
                    <input
                      type="text"
                      readOnly={!editing}
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="e.g. Mumbai, Maharashtra"
                      className={`w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                        editing
                          ? 'bg-white border border-zinc-300 focus:outline-none focus:border-[#114227]'
                          : 'bg-zinc-50 border border-zinc-100 text-zinc-800 cursor-default'
                      }`}
                    />
                  </div>

                  {/* Avatar upload */}
                  <div className="space-y-2">
                    <label htmlFor="avatar-upload" className="text-[11px] font-bold uppercase tracking-wider text-[#617168]">
                      Profile photo
                    </label>
                    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                      {form.avatar ? (
                        <img src={form.avatar} alt="Profile photo preview" className="h-14 w-14 shrink-0 rounded-full object-cover border border-zinc-200" />
                      ) : (
                        <span className="h-14 w-14 shrink-0 rounded-full bg-[#114227] text-white flex items-center justify-center text-xl font-bold" aria-hidden="true">{form.name?.[0]?.toUpperCase() || 'U'}</span>
                      )}
                      <div className="min-w-0 space-y-1.5">
                        <label className={`inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 ${processingAvatar || saving ? 'opacity-50' : 'cursor-pointer hover:bg-zinc-100'} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-700`}>
                          {processingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          <span>{processingAvatar ? 'Preparing photo…' : form.avatar ? 'Change photo' : 'Upload photo'}</span>
                          <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} disabled={processingAvatar || saving} aria-describedby="avatar-upload-help avatar-upload-error" className="sr-only" />
                        </label>
                        <p id="avatar-upload-help" className="text-[10px] leading-relaxed text-[#617168]">JPG, PNG or WebP, up to 5 MB. Save changes to update your photo.</p>
                        {form.avatar && (
                          <button type="button" disabled={processingAvatar || saving} onClick={() => { setForm((prev) => ({ ...prev, avatar: '' })); setEditing(true); setAvatarError('') }} className="text-[11px] font-semibold text-rose-700 hover:underline disabled:opacity-50">Remove photo</button>
                        )}
                      </div>
                    </div>
                    <p id="avatar-upload-error" role="alert" className="text-xs text-rose-700">{avatarError}</p>
                  </div>
                </div>

                {/* Bio / Operational Notes */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#617168]">
                    Bio / Operational Notes
                  </label>
                  <textarea
                    rows={3}
                    readOnly={!editing}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="Short description or notes..."
                    className={`w-full px-4 py-3 rounded-2xl text-sm font-medium transition-all resize-none ${
                      editing
                        ? 'bg-white border border-zinc-300 focus:outline-none focus:border-[#114227]'
                        : 'bg-zinc-50 border border-zinc-100 text-zinc-800 cursor-default'
                    }`}
                  />
                </div>

                {/* Commit Changes Button */}
                {editing && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                    <button
                      type="submit"
                      disabled={saving || processingAvatar}
                      className="w-full py-3.5 px-6 rounded-2xl profile-primary bg-[#315b45] hover:bg-[#254a36] text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Save & Update Profile</span>
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </form>
            </div>
          </div>

          {/* RIGHT 1 COLUMN: ROLE-SPECIFIC PERKS, WALLET & SECURITY */}
          <div className="space-y-6">
            {/* 1. ROLE HIGHLIGHT CARD */}
            {isCustomer && (
              <div className="customer-surface bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-black">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-[#153c2b]">Customer Hub</h3>
                    <p className="text-[11px] text-[#617168] font-medium">Virtual queues & reservations</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-100">
                  <Link
                    to="/queue"
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-[#EAF7EE] text-zinc-700 hover:text-[#114227] text-xs font-bold transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Ticket className="w-4 h-4 text-emerald-600" />
                      <span>Live Queue Ticket</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <Link
                    to="/history"
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-[#EAF7EE] text-zinc-700 hover:text-[#114227] text-xs font-bold transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>Booking History</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            )}

            {isOwner && (
              <div className="customer-surface bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EAF7EE] text-[#114227] border border-[#BDE8CB] flex items-center justify-center font-black">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-[#153c2b]">Hub Operations Suite</h3>
                    <p className="text-[11px] text-[#617168] font-medium">Verified Enterprise Business</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-100">
                  <Link
                    to="/business"
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-[#EAF7EE] text-zinc-700 hover:text-[#114227] text-xs font-bold transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Store className="w-4 h-4 text-[#114227]" />
                      <span>Hub Command Center</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <Link
                    to="/business/onboarding"
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-[#EAF7EE] text-zinc-700 hover:text-[#114227] text-xs font-bold transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Register New Hub</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>

                <div className="pt-2 text-[11px] text-[#617168] font-medium leading-relaxed bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                  <span className="font-bold text-zinc-800">Privileges Active:</span> Multi-counter live queuing, doctor roster management, and AI predictive wait analytics.
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="customer-surface bg-white border border-[#c1d5c7] rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#e6f0e8] text-[#315b45] border border-[#c1d5c7] flex items-center justify-center font-black">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-[#153c2b]">System Root Console</h3>
                    <p className="text-[11px] text-[#315b45] font-bold">Master Administrative Tier</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#c1d5c7]">
                  <Link
                    to="/admin"
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#e6f0e8] hover:bg-[#d9e8dc] text-[#153c2b] text-xs font-bold transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-[#315b45]" />
                      <span>Launch Admin Console</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#315b45] group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>

                <div className="pt-2 text-[11px] text-[#617168] font-medium leading-relaxed bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                  <span className="font-bold text-zinc-800">Root Permissions:</span> Global venue control, user account moderation, queue bypass authorization, and audit logs.
                </div>
              </div>
            )}

            {/* SECURITY & PASSWORD CARD */}
            <div className="customer-surface bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl icon-3d icon-3d-purple shrink-0">
                  <KeyRound className="w-4 h-4" />
                </span>
                <h4 className="font-black text-xs text-[#153c2b] uppercase tracking-wider">
                  Security & Access
                </h4>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[#52675b] font-medium">Auth Provider</span>
                  <span className="font-bold text-[#153c2b] capitalize">
                    {user?.authProvider || 'Email & Password'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[#52675b] font-medium">Email Verification</span>
                  <span
                    className={`font-black text-[10px] uppercase px-2 py-0.5 rounded-full ${
                      isEmailVerified
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#f3e9e1] text-[#765546]'
                    }`}
                  >
                    {isEmailVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-800 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-[#617168]" />
                <span>Change / Reset Password</span>
              </button>
            </div>
          </div>
        </div>

        {/* SIGN OUT ACTION AT THE END */}
        <div className="customer-surface bg-white border border-rose-200/80 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-left">
            <span className="w-10 h-10 rounded-2xl icon-3d icon-3d-rose shrink-0">
              <LogOut className="w-5 h-5 text-white" />
            </span>
            <div>
              <h4 className="text-sm font-black text-[#153c2b]">Session Management</h4>
              <p className="text-xs text-[#617168] font-medium mt-0.5">
                Sign out of your serveQ session on this device.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              logOut()
              navigate('/login')
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
          {user?.role === 'customer' && <Prescriptions result={prescriptions} />}
        </main>
      </div>

      {/* Phone OTP Verification Modal */}
      {phoneModalOpen && <VerifyContactModal
        value={form.phone}
        onClose={() => setPhoneModalOpen(false)}
        onSuccess={(updatedUser) => {
          setUser(updatedUser)
          setPhoneModalOpen(false)
          feedback.success('Phone verified successfully!')
        }}
      />}

      {/* Change / Reset Password Modal */}
      <ForgotPasswordModal
        isOpen={showPasswordModal}
        initialEmail={user?.email || ''}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  )
}
