import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signup, signin } from '../api/auth.api'
import { sendOtp, verifyOtp } from '../api/otp.api'
import { toast } from 'react-hot-toast'

export default function LoginPage() {
  const [tab, setTab] = useState('otp') // Default to OTP for mobile priority, will adjust in render or effect
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer' })
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState('phone') // 'phone' or 'verify'
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { logIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const onChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const apiFn = tab === 'signup' ? signup : signin
      const res = await apiFn(tab === 'signup' ? form : { email: form.email, password: form.password })
      const { user, token } = res.data.data
      logIn(user, token)
      toast.success(tab === 'signin' ? 'Welcome back!' : 'Account created successfully!', {
        style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #f4f4f5' }
      })
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Authentication failed', {
        style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #fef2f2' }
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!phone) return toast.error('Enter phone number')
    setLoading(true)
    try {
      await sendOtp(phone)
      setOtpStep('verify')
      setCountdown(30)
      toast.success('OTP sent to your phone')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) return toast.error('Enter 6-digit OTP')
    setLoading(true)
    try {
      const res = await verifyOtp(phone, otp)
      const responseData = res.data.data || res.data
      const user = responseData.user
      const token = responseData.token
      logIn(user, token)
      toast.success('Successfully logged in!')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  const renderOtpFlow = () => (
    <div className="space-y-5">
      {otpStep === 'phone' ? (
        <form onSubmit={handleSendOtp} className="space-y-5">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Phone Number</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">+</span>
              <input 
                className="input pl-8" 
                type="tel" 
                placeholder="919876543210" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                required 
              />
            </div>
            <p className="text-[9px] text-zinc-400 mt-2 ml-1">Include country code without + (e.g., 91 for India)</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-4 text-xs font-bold"
          >
            {loading ? 'Sending...' : 'Send Access Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Verification Code</label>
            <input 
              className="input text-center tracking-[1em] text-lg font-bold" 
              type="text" 
              maxLength="6" 
              placeholder="000000" 
              value={otp} 
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
              required 
            />
          </div>
          <div className="flex flex-col items-center gap-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-4 text-xs font-bold"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
            
            <div className="flex flex-col items-center gap-3">
              {countdown > 0 ? (
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="transparent"
                      className="text-zinc-100"
                    />
                    <motion.circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="transparent"
                      strokeDasharray="125.6"
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: 125.6 * (1 - countdown / 30) }}
                      transition={{ duration: 1, ease: "linear" }}
                      className="text-teal-600"
                    />
                  </svg>
                  <span className="absolute text-[10px] font-black text-zinc-900">{countdown}s</span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSendOtp}
                  className="text-[10px] font-bold text-teal-600 uppercase tracking-widest hover:underline decoration-2 underline-offset-4"
                >
                  Resend Code
                </button>
              )}
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setOtpStep('phone')} 
            className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mx-auto pt-2 hover:text-zinc-600"
          >
            Change Number
          </button>
        </form>
      )}
    </div>
  )

  const renderEmailFlow = () => (
    <form onSubmit={handleSubmit} className="space-y-5">
      <AnimatePresence mode="wait">
        {tab === 'signup' && (
          <motion.div
            key="signup-fields"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-5 overflow-hidden"
          >
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Full Identity</label>
              <input className="input" name="name" placeholder="John Doe" value={form.name} onChange={onChange} required />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block text-center">Operational Role</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 rounded-xl border border-slate-200">
                {[
                  { v: 'customer', l: 'Customer' },
                  { v: 'owner', l: 'Hub Owner' }
                ].map(r => (
                  <button
                    key={r.v}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, role: r.v }))}
                    className={`py-2.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${form.role === r.v ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    {r.l}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Email Address</label>
        <input className="input" type="email" name="email" placeholder="name@company.com" value={form.email} onChange={onChange} required />
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Security Credential</label>
        <div className="relative">
          <input
            className="input pr-12"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="••••••••"
            value={form.password}
            onChange={onChange}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors"
          >
            {showPassword ? (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            ) : (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-island py-4 text-xs mt-4"
      >
        <span>{loading ? 'Processing...' : tab === 'signin' ? 'Unlock Portal' : 'Create Access'}</span>
        <span className="btn-bubble">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </button>
    </form>
  )

  const GoogleBtn = () => (
    <button
      onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || ''}/api/auth/google`}
      className="flex items-center justify-center gap-3 w-full py-3.5 rounded-full bg-zinc-50 border border-zinc-200/90 text-zinc-700 text-xs font-bold hover:bg-zinc-100 hover:text-zinc-950 transition-all uppercase tracking-wider active:scale-[0.98] shadow-xs"
    >
      <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h4.78c-.19 1.06-.9 1.95-1.78 2.53v2.13h2.87c1.68-1.55 2.65-3.83 2.65-6.53 0-.62-.06-1.22-.16-1.81H12.48z" /><path fill="currentColor" d="M12 23c3.13 0 5.75-1.04 7.67-2.81l-2.87-2.13c-.79.53-1.8.85-2.8.85-2.15 0-3.96-1.45-4.62-3.41H6.18v2.24C8.06 20.9 12 23 12 23z" /><path fill="currentColor" d="M7.38 15.5a6.6 6.6 0 0 1 0-4.14V9.12H6.18C5.43 10.59 5 12.24 5 14s.43 3.41 1.18 4.88l1.2-1.38z" /><path fill="currentColor" d="M12 4.14c1.7 0 3.22.58 4.42 1.73l3.31-3.31C17.75 1.04 15.13 0 12 0 8.06 0 4.14 2.1 2.18 5.48l3.66 2.84c.66-1.96 2.47-3.41 4.62-3.41z" /></svg>
      Neural Sync (Google)
    </button>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#fafaf9] relative overflow-hidden">
      {/* Subtle Background Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-teal-500/8 blur-[130px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white border border-zinc-200/90 flex items-center justify-center mx-auto mb-5 shadow-sm overflow-hidden p-1">
            <img src="/logo.png" alt="serveQ" className="w-full h-full object-cover rounded-xl" />
          </div>
          <h1 className="text-3xl font-black text-zinc-950 tracking-tight leading-none mb-1.5">serveQ</h1>
          <p className="text-zinc-500 text-xs font-semibold tracking-wide">Enterprise Operational Hub</p>
        </div>

        {/* Priority Check: Double-Bezel Form Container */}
        <div className="bezel-shell">
          <div className="bezel-core p-6 sm:p-8">
            {/* Mobile View Priority Rendering */}
            <div className="md:hidden space-y-6">
              <div className="space-y-4">
                <h2 className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest text-center border-b border-zinc-100 pb-3">Secure Mobile Authentication</h2>
                {renderOtpFlow()}
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200/60"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-extrabold"><span className="bg-white px-3 text-zinc-400">or sync</span></div>
              </div>

              <GoogleBtn />

              <div className="pt-2 text-center">
                <button onClick={() => setTab('signin')} className="text-teal-600 text-[11px] font-extrabold uppercase tracking-widest hover:underline decoration-2 underline-offset-4">
                  Corporate Email Terminal
                </button>
              </div>
            </div>

            {/* Desktop View Priority Rendering */}
            <div className="hidden md:block space-y-6">
              <div className="flex bg-zinc-100/70 p-1 rounded-full mb-4 border border-zinc-200/80">
                {['otp', 'signin', 'signup'].map(t => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setOtpStep('phone') }}
                    className={`flex-1 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.97] ${
                      tab === t 
                        ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/80' 
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {t === 'otp' ? 'SMS Link' : t === 'signin' ? 'Email Auth' : 'Registration'}
                  </button>
                ))}
              </div>

              {tab === 'otp' ? renderOtpFlow() : renderEmailFlow()}

              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200/60"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-extrabold"><span className="bg-white px-3 text-zinc-400">or institutional</span></div>
              </div>

              <GoogleBtn />
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
          End-to-End Encrypted Session &bull; v2.4.0
        </p>
      </motion.div>
    </div>
  )
}
