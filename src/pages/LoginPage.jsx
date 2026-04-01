import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signup, signin } from '../api/auth.api'
import { toast } from 'react-hot-toast'

export default function LoginPage() {
  const [tab, setTab] = useState('signin')
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
        style: { borderRadius: '12px', background: '#18181b', color: '#fff', border: '1px solid #14b8a6' }
      })
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Authentication failed', {
        style: { borderRadius: '12px', background: '#18181b', color: '#fff', border: '1px solid #f43f5e' }
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 relative overflow-hidden">
      {/* Subtle Background Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-teal-500/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-xl font-black text-teal-500 mx-auto mb-4 shadow-sm">
            Q
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-2">SmartQueue</h1>
          <p className="text-zinc-500 text-sm font-medium">Enterprise Queue Management Platform</p>
        </div>

        <div className="bg-zinc-900 border border-white/5 p-8 rounded-2xl shadow-xl">
          {/* Tab Selection */}
          <div className="flex bg-zinc-950 p-1 rounded-xl mb-8 border border-white/5">
            {['signin', 'signup'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t) }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  tab === t ? 'bg-zinc-800 text-white shadow-sm border border-white/5' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

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
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Full Identity</label>
                    <input className="input" name="name" placeholder="John Doe" value={form.name} onChange={onChange} required />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block text-center">Operational Role</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 rounded-xl border border-white/5">
                      {[
                        { v: 'customer', l: 'Customer' },
                        { v: 'owner', l: 'Hub Owner' }
                      ].map(r => (
                        <button
                          key={r.v}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, role: r.v }))}
                          className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                            form.role === r.v ? 'bg-teal-500/10 text-teal-500 border border-teal-500/20' : 'text-zinc-600 hover:text-zinc-400 border border-transparent'
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
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Email Address</label>
              <input className="input" type="email" name="email" placeholder="name@company.com" value={form.email} onChange={onChange} required />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Security Credential</label>
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-teal-500 transition-colors"
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
              className="w-full btn-primary py-4 text-xs font-bold mt-4"
            >
              {loading ? 'Processing...' : tab === 'signin' ? 'Sign In to Dashboard' : 'Initialize Account'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button 
              onClick={() => window.location.href = '/api/auth/google'} 
              className="flex items-center justify-center gap-3 w-full py-3 rounded-lg bg-zinc-950 border border-white/5 text-zinc-400 text-[11px] font-bold hover:bg-zinc-800 transition-all uppercase tracking-wider"
            >
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h4.78c-.19 1.06-.9 1.95-1.78 2.53v2.13h2.87c1.68-1.55 2.65-3.83 2.65-6.53 0-.62-.06-1.22-.16-1.81H12.48z"/><path fill="currentColor" d="M12 23c3.13 0 5.75-1.04 7.67-2.81l-2.87-2.13c-.79.53-1.8.85-2.8.85-2.15 0-3.96-1.45-4.62-3.41H6.18v2.24C8.06 20.9 12 23 12 23z"/><path fill="currentColor" d="M7.38 15.5a6.6 6.6 0 0 1 0-4.14V9.12H6.18C5.43 10.59 5 12.24 5 14s.43 3.41 1.18 4.88l1.2-1.38z"/><path fill="currentColor" d="M12 4.14c1.7 0 3.22.58 4.42 1.73l3.31-3.31C17.75 1.04 15.13 0 12 0 8.06 0 4.14 2.1 2.18 5.48l3.66 2.84c.66-1.96 2.47-3.41 4.62-3.41z"/></svg>
              Continue with Google
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
