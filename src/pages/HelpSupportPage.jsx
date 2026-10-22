import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  Mail,
  Clock,
  Info,
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  Building2,
  UserCheck,
  ShieldAlert,
  Send,
  HelpCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSeo } from '../utils/useSeo'
import { sendSupportMessage } from '../api/support.api'

export default function HelpSupportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useSeo({
    title: 'Help & Support — ServeQ',
    description: 'Get in touch with the ServeQ support team for help with your queues, appointments, and business account.',
  })

  const role = user?.role || 'customer'
  const isOwner = role === 'owner'
  const isAdmin = role === 'admin'
  const isCustomer = role === 'customer'

  const backPath = useMemo(() => {
    if (isOwner) return '/business'
    if (isAdmin) return '/admin'
    if (user) return '/customers'
    return '/'
  }, [isOwner, isAdmin, user])

  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submittedTicket, setSubmittedTicket] = useState(null)

  // Auto-fill user data if available
  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        name: prev.name || user.name || '',
        email: prev.email || user.email || '',
      }))
    }
  }, [user])

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'message' && value.length > 1000) return
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error('Please enter your full name')
      return
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      toast.error('Please enter a valid email address')
      return
    }
    if (!form.subject || form.subject === '') {
      toast.error('Please select a subject for your request')
      return
    }
    if (!form.message.trim()) {
      toast.error('Please describe your query or issue')
      return
    }

    setSubmitting(true)
    try {
      const res = await sendSupportMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject,
        message: form.message.trim(),
      })

      if (res.data?.success) {
        setSubmittedTicket({
          ticketNumber: res.data.ticketNumber || 'SUPPORT',
          subject: form.subject,
          email: form.email.trim(),
        })
        toast.success('Your message has been sent to ServeQ Support!', {
          icon: '✅',
          style: {
            borderRadius: '16px',
            background: '#ffffff',
            color: '#09090b',
            border: '1px solid #10b981',
          },
        })
        setForm((prev) => ({
          ...prev,
          subject: '',
          message: '',
        }))
      } else {
        toast.error(res.data?.message || 'Could not send message. Please try again.')
      }
    } catch (err) {
      console.error('Support message submission error:', err)
      toast.error(err.response?.data?.message || 'Failed to send message. Please email support@serveq.tech directly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-zinc-900 pb-20 font-sans selection:bg-emerald-500/20 selection:text-emerald-900 relative overflow-hidden">
      {/* ── TOP NAV BREADCRUMB BAR ── */}
      <div className="bg-white/90 backdrop-blur-md border-b border-zinc-200/80 sticky top-0 z-30 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link
            to={backPath}
            className="flex items-center gap-2 text-xs font-bold text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>
              Return to {isOwner ? 'Hub Console' : isAdmin ? 'Admin Console' : user ? 'Customer Portal' : 'Home'}
            </span>
          </Link>

          {user && (
            <div className="flex items-center gap-2.5">
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
              <span className="text-xs text-zinc-500 font-medium hidden sm:inline">
                {user.email}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── AMBIENT BACKGROUND GLOWS (Matching Screenshot) ── */}
      <div className="absolute top-12 left-0 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none -translate-x-1/2" />
      <div className="absolute top-8 right-0 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl pointer-events-none translate-x-1/3" />

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 relative z-10 space-y-8 sm:space-y-10">
        
        {/* Header Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs">
            HELP & SUPPORT
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 tracking-tight">
            We’re here to help
          </h1>
          <p className="text-zinc-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed font-medium">
            Have a question, facing an issue, or need more information?
            <br className="hidden sm:inline" /> Fill out the form below and our team will get back to you as soon as possible.
          </p>
        </div>

        {/* Success Confirmation Modal / Banner if just submitted */}
        <AnimatePresence>
          {submittedTicket && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-emerald-950">
                    Message Sent Successfully (Ticket #{submittedTicket.ticketNumber})
                  </h2>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    We've emailed a confirmation to <strong>{submittedTicket.email}</strong>. Our support team will reply within 24 hours.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubmittedTicket(null)}
                className="text-xs font-bold text-emerald-900 bg-white border border-emerald-300 hover:bg-emerald-100/50 px-3.5 py-1.5 rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                Send Another Note
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CARD CONTAINER (Matching Screenshot) ── */}
        <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xl shadow-zinc-950/4 p-6 sm:p-8 md:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            
            {/* LEFT COLUMN: FORM */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                  Send us a message
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1 mb-6">
                  Share the details of your query and we'll get back to you shortly.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                  {/* Name & Email Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-700">
                        Your Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Enter your full name"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-700">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Subject Dropdown */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-700">
                      Subject <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        name="subject"
                        value={form.subject}
                        onChange={handleChange}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all appearance-none cursor-pointer pr-10"
                        required
                      >
                        <option value="" disabled>Select a subject</option>
                        <option value="General Inquiry">General Inquiry</option>
                        <option value="Queue Management & Live Wait Times">Queue Management & Live Wait Times</option>
                        <option value="Appointments & Booking Issue">Appointments & Booking Issue</option>
                        <option value="Business / Partner Hub Management">Business / Partner Hub Management</option>
                        <option value="Account, Profile & Verification">Account, Profile & Verification</option>
                        <option value="Wallet, Payments & Billing">Wallet, Payments & Billing</option>
                        <option value="Technical Bug or Glitch">Technical Bug or Glitch</option>
                        <option value="Other Feedback">Other Feedback</option>
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Message Field */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-700">
                      Message <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      name="message"
                      rows={5}
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Describe your query or issue in detail..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all resize-none"
                      required
                    />
                    <div className="flex justify-end">
                      <span className="text-[11px] font-medium text-zinc-400">
                        {form.message.length}/1000
                      </span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-[#0D361F] hover:bg-[#072413] transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending Message...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Message</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* RIGHT COLUMN: CONTACT INFO & CHAT GRAPHIC */}
            <div className="lg:col-span-5 bg-[#F2F8F5] border border-[#E1EFE7] rounded-2xl p-6 sm:p-7 flex flex-col justify-between space-y-6">
              
              {/* Top Illustration: Chat Bubbles matching screenshot */}
              <div className="relative py-4 flex items-center justify-center">
                {/* Ambient glow behind bubbles */}
                <div className="w-36 h-36 rounded-full bg-emerald-100/70 absolute blur-xl" />

                <div className="relative w-44 h-32 flex items-center justify-center">
                  {/* Green primary bubble with 3 dots */}
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="absolute top-2 left-4 w-24 h-18 bg-[#0D361F] rounded-2xl rounded-bl-sm p-3.5 shadow-md flex items-center justify-center z-10"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                    </div>
                  </motion.div>

                  {/* Overlapping white/mint bubble with text lines */}
                  <motion.div
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="absolute bottom-2 right-4 w-22 h-16 bg-white border border-emerald-200/90 rounded-2xl rounded-tr-sm p-3 shadow-sm flex flex-col justify-center gap-1.5 z-20"
                  >
                    <div className="w-12 h-2 rounded-full bg-emerald-500/70" />
                    <div className="w-8 h-2 rounded-full bg-emerald-400/50" />
                  </motion.div>

                  {/* Little accent sparks */}
                  <div className="absolute top-0 right-8 text-emerald-600 font-black text-xs select-none">
                    ✦
                  </div>
                </div>
              </div>

              {/* Information Cards */}
              <div className="space-y-4">
                {/* 1. Email Support */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-800">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900">
                      Email Support
                    </h3>
                    <a
                      href="mailto:support@serveq.tech"
                      className="text-xs sm:text-sm font-medium text-emerald-800 hover:underline block"
                    >
                      support@serveq.tech
                    </a>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      We typically reply within 24 hours.
                    </p>
                  </div>
                </div>

                {/* 2. Support Hours */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-800">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900">
                      Support Hours
                    </h3>
                    <p className="text-xs sm:text-sm font-medium text-zinc-700">
                      Monday – Saturday
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      9:00 AM – 7:00 PM (IST)
                    </p>
                  </div>
                </div>

                {/* 3. Before reaching out */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-800">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900">
                      Before reaching out
                    </h3>
                    <p className="text-[11px] text-zinc-600 leading-relaxed mt-0.5">
                      Please share relevant details such as your account email, business name and a brief description of the issue.
                    </p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
