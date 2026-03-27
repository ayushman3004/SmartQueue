import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signup, signin } from '../api/auth.api'

export default function LoginPage() {
  const [tab, setTab] = useState('signin')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { logIn } = useAuth()
  const navigate = useNavigate()

  const onChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const apiFn = tab === 'signup' ? signup : signin
      const res = await apiFn(tab === 'signup' ? form : { email: form.email, password: form.password })
      const { user, token } = res.data.data
      logIn(user, token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#080b0f]">
      {/* Background Decor */}
      <div className="absolute top-0 right-[-10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[480px] z-10"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            className="w-20 h-20 rounded-3xl bg-linear-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-3xl font-black text-black mx-auto mb-6 shadow-2xl shadow-cyan-500/20"
          >
            Q
          </motion.div>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tighter uppercase">Smart Queue</h1>
          <p className="text-neutral-500 font-medium tracking-wide">AI-Powered Hub Flow System</p>
        </div>

        <div className="glass-bright p-10 border-white/10 shadow-3xl">
          {/* Tab Selection */}
          <div className="flex bg-black/40 p-1.5 rounded-2xl mb-8 border border-white/5">
            {['signin', 'signup'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError('') }}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  tab === t ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'
                }`}
              >
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {tab === 'signup' && (
                <motion.div
                  key="signup-fields"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-6 overflow-hidden"
                >
                  <div className="group">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block group-focus-within:text-cyan-500 transition-colors">Identity</label>
                    <input className="input !bg-black/30 !py-4" name="name" placeholder="Full Name" value={form.name} onChange={onChange} required />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3 block text-center">Your Role</label>
                    <div className="grid grid-cols-2 gap-3 p-1 bg-black/30 rounded-2xl">
                      {[
                        { v: 'user', l: 'Customer' },
                        { v: 'owner', l: 'Merchant' }
                      ].map(r => (
                        <button
                          key={r.v}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, role: r.v }))}
                          className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                            form.role === r.v ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' : 'border-transparent text-neutral-600'
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

            <div className="group">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block group-focus-within:text-cyan-500 transition-colors">Email</label>
              <input className="input !bg-black/30 !py-4" type="email" name="email" placeholder="name@hub.com" value={form.email} onChange={onChange} required />
            </div>

            <div className="group">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block group-focus-within:text-cyan-500 transition-colors">Credential</label>
              <input className="input !bg-black/30 !py-4" type="password" name="password" placeholder="••••••••" value={form.password} onChange={onChange} required />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-bold text-center">
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 rounded-2xl bg-white text-black font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              {loading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : tab === 'signin' ? 'Unlock Portal' : 'Create Access'}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <button onClick={() => window.location.href = '/api/auth/google'} className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-white/5 border border-white/5 text-neutral-400 text-xs font-bold hover:bg-white/10 transition-all uppercase tracking-widest">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h4.78c-.19 1.06-.9 1.95-1.78 2.53v2.13h2.87c1.68-1.55 2.65-3.83 2.65-6.53 0-.62-.06-1.22-.16-1.81H12.48z"/><path fill="currentColor" d="M12 23c3.13 0 5.75-1.04 7.67-2.81l-2.87-2.13c-.79.53-1.8.85-2.8.85-2.15 0-3.96-1.45-4.62-3.41H6.18v2.24C8.06 20.9 12 23 12 23z"/><path fill="currentColor" d="M7.38 15.5a6.6 6.6 0 0 1 0-4.14V9.12H6.18C5.43 10.59 5 12.24 5 14s.43 3.41 1.18 4.88l1.2-1.38z"/><path fill="currentColor" d="M12 4.14c1.7 0 3.22.58 4.42 1.73l3.31-3.31C17.75 1.04 15.13 0 12 0 8.06 0 4.14 2.1 2.18 5.48l3.66 2.84c.66-1.96 2.47-3.41 4.62-3.41z"/></svg>
              Neural Sync (Google)
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
