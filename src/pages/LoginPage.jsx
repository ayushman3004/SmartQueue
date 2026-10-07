import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signup, signin } from '../api/auth.api'
import { toast } from 'react-hot-toast'

export default function LoginPage() {
  const [tab, setTab] = useState('signin') // 'signin' or 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { logIn } = useAuth()
  const navigate = useNavigate()

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

  const handleGoogleAuth = () => {
    localStorage.removeItem('auth_redirect')
    const apiUrl = import.meta.env.VITE_API_URL || ''
    window.location.href = `${apiUrl}/api/auth/google?role=customer`
  }

  const GoogleBtn = () => (
    <button
      type="button"
      onClick={handleGoogleAuth}
      className="flex items-center justify-center gap-3 w-full py-3.5 rounded-full bg-zinc-50 border border-zinc-200/90 text-zinc-700 text-xs font-bold hover:bg-zinc-100 hover:text-zinc-950 transition-all uppercase tracking-wider active:scale-[0.98] shadow-xs"
    >
      <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h4.78c-.19 1.06-.9 1.95-1.78 2.53v2.13h2.87c1.68-1.55 2.65-3.83 2.65-6.53 0-.62-.06-1.22-.16-1.81H12.48z" /><path fill="currentColor" d="M12 23c3.13 0 5.75-1.04 7.67-2.81l-2.87-2.13c-.79.53-1.8.85-2.8.85-2.15 0-3.96-1.45-4.62-3.41H6.18v2.24C8.06 20.9 12 23 12 23z" /><path fill="currentColor" d="M7.38 15.5a6.6 6.6 0 0 1 0-4.14V9.12H6.18C5.43 10.59 5 12.24 5 14s.43 3.41 1.18 4.88l1.2-1.38z" /><path fill="currentColor" d="M12 4.14c1.7 0 3.22.58 4.42 1.73l3.31-3.31C17.75 1.04 15.13 0 12 0 8.06 0 4.14 2.1 2.18 5.48l3.66 2.84c.66-1.96 2.47-3.41 4.62-3.41z" /></svg>
      Neural Sync (Google)
    </button>
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
          <div className="bezel-core p-6 sm:p-8 space-y-6">
            <div className="flex bg-zinc-100/70 p-1 rounded-full border border-zinc-200/80">
              {[
                { id: 'signin', label: 'Sign In' },
                { id: 'signup', label: 'Create Account' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.97] ${
                    tab === t.id 
                      ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/80' 
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {renderEmailFlow()}

            <div className="relative pt-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200/60"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-extrabold"><span className="bg-white px-3 text-zinc-400">or sync with</span></div>
            </div>

            <GoogleBtn />
          </div>
        </div>

        {/* Hub Owner Exclusive Portal Link */}
        <div className="mt-5 p-3.5 rounded-2xl bg-white border border-teal-200/90 shadow-sm text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-teal-800">
            <span>🏢</span>
            <span>Are you a Business / Hub Owner?</span>
          </div>
          <Link
            to="/business"
            className="inline-flex items-center gap-1 text-xs font-black text-teal-600 hover:text-teal-800 transition-colors"
          >
            <span>Go to Hub Owner Portal (serveq.tech/business)</span>
            <span>→</span>
          </Link>
        </div>

        <p className="mt-6 text-center text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
          End-to-End Encrypted Session &bull; v2.4.0
        </p>
      </motion.div>
    </div>
  )
}
