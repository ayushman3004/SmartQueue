import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { CheckCircle2, Mail, Smartphone, ShieldCheck, AlertCircle } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useSeo } from '../utils/useSeo'
import { isValidEmail } from '../utils/validators'
import VerifyContactModal from '../components/VerifyContactModal'

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [verifyModal, setVerifyModal] = useState({
    isOpen: false,
    type: 'email',
    value: '',
  })

  useSeo({
    title: 'Profile & Account Security',
    description: 'Manage your serveQ user profile, contact details, and account settings.',
    robots: 'noindex, nofollow',
  })

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

  const handleOpenEmailVerify = () => {
    if (!form.email || !form.email.trim()) {
      toast.error('Please enter an email address first')
      return
    }
    if (!isValidEmail(form.email.trim())) {
      toast.error('Please enter a valid email format (e.g. name@domain.com)')
      return
    }
    setVerifyModal({
      isOpen: true,
      type: 'email',
      value: form.email.trim(),
    })
  }

  const handleOpenPhoneVerify = () => {
    const rawPhone = form.phone ? form.phone.trim().replace(/[\s\-()]/g, '') : ''
    if (!rawPhone || rawPhone.length < 8) {
      toast.error('Please enter a valid phone number (at least 8-10 digits)')
      return
    }
    setVerifyModal({
      isOpen: true,
      type: 'phone',
      value: form.phone.trim(),
    })
  }

  const handleVerificationSuccess = (updatedUser) => {
    setUser(updatedUser)
    setForm((prev) => ({
      ...prev,
      email: updatedUser.email || prev.email,
      phone: updatedUser.phone || prev.phone,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.email && !isValidEmail(form.email)) {
      toast.error('Please enter a valid email address (e.g. name@domain.com)')
      return
    }
    setLoading(true)
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
      toast.error(err.response?.data?.message || 'Failed to update profile', {
        style: { borderRadius: '16px', background: '#ffffff', color: '#09090b', border: '1px solid #fef2f2' },
      })
    } finally {
      setLoading(false)
    }
  }

  const isEmailVerified = Boolean(user?.isEmailVerified && form.email === user?.email)
  const isPhoneVerified = Boolean(user?.isPhoneVerified && form.phone && form.phone === user?.phone)

  return (
    <div className="container max-w-4xl px-4 sm:px-6 pt-12 pb-20">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border border-zinc-200 overflow-hidden rounded-[3rem] shadow-2xl"
      >
        {/* Profile Header Background */}
        <div className="h-48 relative overflow-hidden bg-slate-900 shadow-inner">
          <div className="absolute inset-0 bg-white/[0.03] grid-pattern pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px]" />
          <div className="absolute top-10 left-10">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-500 mb-2 block opacity-80">
              User Identity Hub
            </span>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
              Security Center
            </h1>
          </div>
        </div>

        <div className="p-8 md:p-12 relative">
          {/* Avatar Section */}
          <div className="absolute -top-16 left-12 group">
            <div className="relative">
              {form.avatar ? (
                <img
                  src={form.avatar}
                  className="w-32 h-32 rounded-3xl object-cover border-4 border-white shadow-2xl transition-transform group-hover:scale-105"
                  alt="Avatar"
                />
              ) : (
                <div className="w-32 h-32 rounded-3xl flex items-center justify-center text-4xl font-black text-white bg-linear-to-br from-teal-500 to-indigo-600 border-4 border-white shadow-2xl transition-transform group-hover:scale-105">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}
              {editing && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="text-[8px] font-black uppercase tracking-widest text-white">Update Node</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-20 space-y-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-3xl font-black text-zinc-950 uppercase tracking-tighter leading-none">
                  {user?.name}
                </h2>
                <div className="flex items-center gap-3 mt-3">
                  <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-[10px] font-black text-teal-700 uppercase tracking-widest border border-teal-100">
                    {user?.role} ACCESS
                  </span>
                  <div className="w-1 h-1 rounded-full bg-zinc-200" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    NODE_ID: {user?._id?.slice(-8)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(!editing)}
                className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-xs border ${
                  editing
                    ? 'bg-rose-50 text-rose-600 border-rose-100'
                    : 'bg-slate-50 border-zinc-200 text-slate-500 hover:bg-white hover:text-zinc-950 shadow-sm'
                }`}
              >
                {editing ? 'Discard Overrides' : 'Modify Profile'}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6 md:col-span-1">
                {/* Primary Descriptor */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                    Primary Descriptor
                  </label>
                  <input
                    readOnly={!editing}
                    className="input text-sm font-bold bg-slate-50 border-zinc-100 shadow-xs focus:bg-white"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                {/* Email Terminal with Side Verification Button */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      Email Terminal
                    </label>
                    {isEmailVerified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        Unverified
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        readOnly={!editing}
                        type="email"
                        className={`input text-sm font-bold shadow-xs transition-all ${
                          !editing ? 'bg-slate-50 border-zinc-100' : 'bg-white border-zinc-300 focus:bg-white'
                        }`}
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="your-name@domain.com"
                      />
                    </div>
                    {isEmailVerified ? (
                      <button
                        type="button"
                        disabled
                        className="px-4 py-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/90 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0 opacity-90 cursor-default shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Verified</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleOpenEmailVerify}
                        className="px-4 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all shadow-md shadow-teal-600/20"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Verify OTP</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Phone Number / Communication Link with Side Verification Button */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      Phone Number (Communication Link)
                    </label>
                    {isPhoneVerified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        Unverified
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        readOnly={!editing}
                        type="tel"
                        className={`input text-sm font-bold shadow-xs transition-all ${
                          !editing ? 'bg-slate-50 border-zinc-100' : 'bg-white border-zinc-300 focus:bg-white'
                        }`}
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    {isPhoneVerified ? (
                      <button
                        type="button"
                        disabled
                        className="px-4 py-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/90 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0 opacity-90 cursor-default shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Verified</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleOpenPhoneVerify}
                        className="px-4 py-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 active:scale-95 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all shadow-md shadow-zinc-950/20"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-teal-400" />
                        <span>Verify OTP</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6 md:col-span-1">
                {/* Regional Sector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                    Regional Sector
                  </label>
                  <input
                    readOnly={!editing}
                    className="input text-sm font-bold bg-slate-50 border-zinc-100 shadow-xs focus:bg-white"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>

                {/* Resource Pointer (Avatar) */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                    Resource Pointer (Avatar)
                  </label>
                  <input
                    readOnly={!editing}
                    className="input text-sm font-bold bg-slate-50 border-zinc-100 shadow-xs focus:bg-white"
                    value={form.avatar}
                    onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                    placeholder="https://secure-resource.com/file"
                  />
                </div>

                {/* Operational Bio */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                    Operational Bio
                  </label>
                  <textarea
                    readOnly={!editing}
                    className="input text-sm font-bold min-h-[100px] py-4 bg-slate-50 border-zinc-100 shadow-xs focus:bg-white"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  />
                </div>
              </div>

              {editing && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="md:col-span-2 pt-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-6 rounded-3xl bg-zinc-950 text-white font-black uppercase tracking-[0.3em] text-[10px] shadow-2xl active:scale-95 transition-all relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative z-10">
                      {loading ? 'Synchronizing Genesis...' : 'Commit Global Overrides'}
                    </span>
                  </button>
                </motion.div>
              )}
            </form>
          </div>
        </div>
      </motion.div>

      {/* OTP Verification Modal for Phone or Email */}
      <VerifyContactModal
        isOpen={verifyModal.isOpen}
        type={verifyModal.type}
        value={verifyModal.value}
        onClose={() => setVerifyModal({ isOpen: false, type: 'email', value: '' })}
        onSuccess={handleVerificationSuccess}
      />
    </div>
  )
}

