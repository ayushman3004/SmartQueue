import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
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
  Wallet,
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
} from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useSeo } from '../utils/useSeo'
import { isValidEmail } from '../utils/validators'
import { sendEmailOtp, verifyEmailOtp, upgradeToOwner } from '../api/auth.api'
import VerifyContactModal from '../components/VerifyContactModal'
import ForgotPasswordModal from '../components/ForgotPasswordModal'

export default function ProfilePage() {
  const { user, setUser, logOut } = useAuth()
  const navigate = useNavigate()

  useSeo({
    title: 'Profile & Account Security — serveQ',
    description: 'Manage your serveQ profile, verify your contact details, and configure role settings.',
    robots: 'noindex, nofollow',
  })

  // Edit profile state
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [upgradingRole, setUpgradingRole] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  // Phone modal
  const [phoneModalOpen, setPhoneModalOpen] = useState(false)

  // Inline Email Verification State
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtp, setEmailOtp] = useState('')
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false)
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)

  // Form data
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    location: user?.location || '',
    avatar: user?.avatar || '',
  })

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.bio || '',
        location: user.location || '',
        avatar: user.avatar || '',
      })
    }
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
    user?.isPhoneVerified && form.phone && form.phone?.trim() === user?.phone?.trim()
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
      toast.error('Please enter a valid email address (e.g. name@domain.com)')
      return
    }

    setSendingEmailOtp(true)
    try {
      const res = await sendEmailOtp(targetEmail)
      setEmailOtpSent(true)
      setOtpCooldown(30)
      toast.success(res.data?.message || `Verification code sent to ${targetEmail}`, {
        style: { borderRadius: '16px', background: '#ffffff', color: '#09090b', border: '1px solid #14b8a6' },
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send email verification OTP')
    } finally {
      setSendingEmailOtp(false)
    }
  }

  // Verify Email OTP Handler
  const handleVerifyEmailOtp = async (e) => {
    e?.preventDefault()
    const targetEmail = (form.email || user?.email || '').trim()
    const code = emailOtp.trim()

    if (!code || code.length < 6) {
      toast.error('Please enter the complete 6-digit OTP code')
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
        toast.success('Email address verified successfully!', {
          style: { borderRadius: '16px', background: '#ffffff', color: '#09090b', border: '1px solid #10b981' },
          icon: '🎉',
        })
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP code')
    } finally {
      setVerifyingEmailOtp(false)
    }
  }

  // Save Profile Details
  const handleSaveProfile = async (e) => {
    e?.preventDefault()
    if (form.email && !isValidEmail(form.email.trim())) {
      toast.error('Please provide a valid email format')
      return
    }

    setSaving(true)
    try {
      const res = await api.patch('/auth/me', form)
      if (res.data.success) {
        setUser(res.data.data.user)
        toast.success('Profile updated successfully!', {
          style: { borderRadius: '16px', background: '#ffffff', color: '#09090b', border: '1px solid #f4f4f5' },
        })
        setEditing(false)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  // Upgrade Account to Hub Owner (for customers)
  const handleUpgradeAccount = async () => {
    if (!window.confirm('Upgrade your account to Hub Owner? This will unlock venue registration and live counter management.')) {
      return
    }
    setUpgradingRole(true)
    try {
      const res = await upgradeToOwner()
      setUser(res.data.data.user)
      toast.success('Congratulations! Your account is now upgraded to Hub Owner.', {
        style: { borderRadius: '16px', background: '#ffffff', color: '#09090b', border: '1px solid #14b8a6' },
      })
      navigate('/business')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upgrade account')
    } finally {
      setUpgradingRole(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-zinc-900 pb-24 font-sans selection:bg-emerald-500/20 selection:text-emerald-900">
      {/* ── TOP NAV BREADCRUMB BAR ── */}
      <div className="bg-white border-b border-zinc-200/80 sticky top-0 z-30 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link
            to={backPath}
            className="flex items-center gap-2 text-xs font-bold text-zinc-600 hover:text-zinc-950 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Return to {isOwner ? 'Hub Console' : isAdmin ? 'Admin Console' : 'Customer Portal'}</span>
          </Link>

          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isAdmin
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : isOwner
                  ? 'bg-[#EAF7EE] text-[#114227] border-[#BDE8CB]'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {role.toUpperCase()} ACCOUNT
            </span>

            <button
              type="button"
              onClick={() => {
                logOut()
                navigate('/login')
              }}
              className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* ── HERO IDENTITY CARD ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden"
        >
          {/* Decorative ambient gradient backdrop */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            {/* Avatar & User Details */}
            <div className="flex items-center gap-5">
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
                  <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                    {user?.name || 'ServeQ Member'}
                  </h1>
                  {isAdmin && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-purple-700" />
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

                <p className="text-xs sm:text-sm text-zinc-600 font-medium">
                  {user?.email}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-zinc-500 font-medium">
                  {user?.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                      {user.location}
                    </span>
                  )}
                  <span className="text-zinc-300">•</span>
                  <span className="text-zinc-400">Node ID: {user?._id?.slice(-8) || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions (Edit Button) */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setEditing((prev) => !prev)}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  editing
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    : 'bg-[#114227] hover:bg-[#0D361F] text-white shadow-xs'
                }`}
              >
                {editing ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel Editing</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
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
            className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-white border-2 border-amber-300/80 shadow-xs relative overflow-hidden text-left space-y-4"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                      Action Required
                    </span>
                    <h3 className="text-base font-black text-zinc-950">
                      Email Address Not Verified
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-600 font-medium mt-1 leading-relaxed max-w-2xl">
                    Your account email <span className="font-bold text-zinc-900">{form.email || user?.email}</span> is currently unverified. Verify with a 6-digit OTP to enable queue pass receipts, booking alerts, and account recovery.
                  </p>
                </div>
              </div>

              {!emailOtpSent && (
                <button
                  type="button"
                  disabled={sendingEmailOtp}
                  onClick={() => handleSendEmailOtp()}
                  className="px-5 py-2.5 rounded-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
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
                className="pt-3 border-t border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/60 p-4 rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
                      Enter 6-Digit Passcode
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      placeholder="• • • • • •"
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-44 px-3.5 py-2 text-center text-lg font-black tracking-widest bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-zinc-900 shadow-2xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={verifyingEmailOtp || emailOtp.length < 6}
                    className="mt-4 px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
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
                    <span className="text-zinc-500 font-semibold text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      Resend code in {otpCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={sendingEmailOtp}
                      onClick={() => handleSendEmailOtp()}
                      className="text-amber-800 hover:text-amber-950 font-bold underline text-xs cursor-pointer flex items-center gap-1"
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
            <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div className="space-y-0.5">
                  <h3 className="text-lg font-black text-zinc-950 tracking-tight">
                    Account Credentials
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
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
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Email Terminal
                    </label>
                    {isEmailVerified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
                        <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        Unverified
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
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
                        className="px-4 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs"
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
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Mobile Number (SMS Alerts)
                    </label>
                    {isPhoneVerified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
                        <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-200">
                        Optional
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="tel"
                        readOnly={!editing}
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                        className="px-4 py-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Verify Phone</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Location */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
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

                  {/* Avatar URL */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Avatar Picture URL
                    </label>
                    <input
                      type="text"
                      readOnly={!editing}
                      value={form.avatar}
                      onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      className={`w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                        editing
                          ? 'bg-white border border-zinc-300 focus:outline-none focus:border-[#114227]'
                          : 'bg-zinc-50 border border-zinc-100 text-zinc-800 cursor-default'
                      }`}
                    />
                  </div>
                </div>

                {/* Bio / Operational Notes */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
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
                      disabled={saving}
                      className="w-full py-3.5 px-6 rounded-2xl bg-[#114227] hover:bg-[#0D361F] text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
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
              <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-black">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-zinc-950">Customer Hub</h3>
                    <p className="text-[11px] text-zinc-500 font-medium">Virtual queues & reservations</p>
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

                {/* Upgrade to Owner CTA */}
                <div className="pt-3 border-t border-zinc-100 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border border-[#BDE8CB] space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#114227]" />
                    <span className="text-xs font-black text-zinc-950">Run a Business Venue?</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
                    Upgrade to a Hub Owner account to register venues, manage service catalogs, and run live queues.
                  </p>
                  <button
                    type="button"
                    disabled={upgradingRole}
                    onClick={handleUpgradeAccount}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#114227] hover:bg-[#0D361F] text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {upgradingRole ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Upgrading...</span>
                      </>
                    ) : (
                      <>
                        <span>Upgrade to Hub Owner</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {isOwner && (
              <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EAF7EE] text-[#114227] border border-[#BDE8CB] flex items-center justify-center font-black">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-zinc-950">Hub Operations Suite</h3>
                    <p className="text-[11px] text-zinc-500 font-medium">Verified Enterprise Business</p>
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

                <div className="pt-2 text-[11px] text-zinc-500 font-medium leading-relaxed bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                  <span className="font-bold text-zinc-800">Privileges Active:</span> Multi-counter live queuing, doctor/barber roster management, and AI predictive wait analytics.
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="bg-white border border-purple-200/90 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-black">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-zinc-950">System Root Console</h3>
                    <p className="text-[11px] text-purple-600 font-bold">Master Administrative Tier</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-purple-100">
                  <Link
                    to="/admin"
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-purple-50/60 hover:bg-purple-100 text-purple-900 text-xs font-bold transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-purple-700" />
                      <span>Launch Admin Console</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-purple-500 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>

                <div className="pt-2 text-[11px] text-zinc-500 font-medium leading-relaxed bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                  <span className="font-bold text-zinc-800">Root Permissions:</span> Global venue control, user account moderation, queue bypass authorization, and audit logs.
                </div>
              </div>
            )}

            {/* 2. WALLET & PAYOUTS CARD */}
            <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#EAF7EE] text-[#114227] border border-[#BDE8CB] flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <h4 className="font-black text-xs text-zinc-950 uppercase tracking-wider">
                    ServeQ Wallet
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Live Balance
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#EAF7EE]/60 border border-[#BDE8CB] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    Current Balance
                  </p>
                  <p className="text-2xl font-black text-[#114227] mt-0.5">
                    ₹{(user?.walletBalance ?? 0).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/wallet')}
                  className="px-3.5 py-1.5 rounded-xl bg-[#114227] hover:bg-[#0D361F] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  View Wallet →
                </button>
              </div>
            </div>

            {/* 3. SECURITY & PASSWORD CARD */}
            <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h4 className="font-black text-xs text-zinc-950 uppercase tracking-wider">
                  Security & Access
                </h4>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-zinc-600 font-medium">Auth Provider</span>
                  <span className="font-bold text-zinc-900 capitalize">
                    {user?.authProvider || 'Email & Password'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-zinc-600 font-medium">Email Verification</span>
                  <span
                    className={`font-black text-[10px] uppercase px-2 py-0.5 rounded-full ${
                      isEmailVerified
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
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
                <Lock className="w-3.5 h-3.5 text-zinc-500" />
                <span>Change / Reset Password</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Phone OTP Verification Modal */}
      <VerifyContactModal
        isOpen={phoneModalOpen}
        type="phone"
        value={form.phone}
        onClose={() => setPhoneModalOpen(false)}
        onSuccess={(updatedUser) => {
          setUser(updatedUser)
          setPhoneModalOpen(false)
          toast.success('Phone verified successfully!')
        }}
      />

      {/* Change / Reset Password Modal */}
      <ForgotPasswordModal
        isOpen={showPasswordModal}
        initialEmail={user?.email || ''}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  )
}
