import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { signup, signin, upgradeToOwner } from '../api/auth.api'
import { getMyBusinesses } from '../api/business.api'
import { toast } from 'react-hot-toast'
import RegisterHubModal from '../components/RegisterHubModal'
import ManageServicesModal from '../components/ManageServicesModal'
import { CATEGORY_METADATA } from '../utils/servicePresets'

export default function BusinessPortalPage() {
  const { user, logIn, logOut, setUser } = useAuth()
  const { socket, onBusinessStatus } = useSocket()
  const navigate = useNavigate()

  // Auth form states
  const [authTab, setAuthTab] = useState('signin') // 'signin' or 'signup'
  const [form, setForm] = useState({ name: '', businessName: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Role mismatch state for customers attempting to log in
  const [customerMismatch, setCustomerMismatch] = useState(null)
  const [upgrading, setUpgrading] = useState(false)

  // Hub Owner Dashboard states (for logged-in owners)
  const [myBusinesses, setMyBusinesses] = useState([])
  const [fetchingHubs, setFetchingHubs] = useState(false)
  const [registerHubOpen, setRegisterHubOpen] = useState(false)
  const [manageServicesBiz, setManageServicesBiz] = useState(null)

  const isOwnerOrAdmin = user && (user.role === 'owner' || user.role === 'admin')
  const isCustomer = user && user.role === 'customer'

  // Fetch businesses if logged in as owner
  const loadHubs = useCallback(async () => {
    if (!isOwnerOrAdmin) return
    setFetchingHubs(true)
    try {
      const res = await getMyBusinesses()
      setMyBusinesses(res.data.data.businesses || [])
    } catch (err) {
      console.error('Failed to load hubs:', err)
    } finally {
      setFetchingHubs(false)
    }
  }, [isOwnerOrAdmin])

  useEffect(() => {
    if (isOwnerOrAdmin) {
      loadHubs()
    }
  }, [isOwnerOrAdmin, loadHubs])

  // Real-time status sync for hubs
  useEffect(() => {
    if (!isOwnerOrAdmin) return
    const unsub = onBusinessStatus?.((data) => {
      setMyBusinesses(prev =>
        prev.map(b => (b._id === data.businessId ? { ...b, isOpen: data.isOpen, isActive: data.isActive } : b))
      )
    })
    return () => unsub?.()
  }, [isOwnerOrAdmin, onBusinessStatus])

  const onChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setCustomerMismatch(null)
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
        toast.success('Hub Owner account registered successfully!', {
          style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #14b8a6' }
        })
      } else {
        const payload = {
          email: form.email.trim(),
          password: form.password,
          requiredRole: 'owner', // Enforce Hub Owner role check
        }
        const res = await signin(payload)
        const { user: authUser, token } = res.data.data
        if (authUser.role !== 'owner' && authUser.role !== 'admin') {
          // Safety guard
          setCustomerMismatch({ user: authUser, token })
          toast.error('This account is registered as a Customer, not a Hub Owner.')
          return
        }
        logIn(authUser, token)
        toast.success(`Welcome back, ${authUser.name}!`, {
          style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #14b8a6' }
        })
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Authentication failed'
      if (err.response?.status === 403 && msg.toLowerCase().includes('customer')) {
        setCustomerMismatch({ email: form.email })
      }
      toast.error(msg, {
        style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #fecdd3' }
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
        icon: '🎉',
        style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #14b8a6' }
      })
      loadHubs()
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
      <div className="min-h-screen bg-[#07090e] text-white flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-teal-500/10 blur-[140px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl mx-auto shadow-inner">
            🛡️
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Customer Account Detected
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Hub Owner Access Only
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium leading-relaxed max-w-md mx-auto">
              You are currently signed in as <span className="text-white font-bold">{user.email}</span> with a customer account. The <span className="text-teal-400 font-bold">serveq.tech/business</span> portal is exclusively reserved for Business & Hub Owners.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              disabled={upgrading}
              onClick={handleUpgradeCurrentAccount}
              className="w-full py-3.5 px-6 rounded-full bg-teal-500 hover:bg-teal-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>{upgrading ? 'Upgrading Account...' : '✨ Upgrade Account to Hub Owner'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full py-3.5 px-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs uppercase tracking-wider transition-all"
            >
              ← Return to Customer Dashboard
            </button>

            <button
              type="button"
              onClick={() => { logOut(); navigate('/business') }}
              className="text-[11px] font-bold text-zinc-500 hover:text-rose-400 transition-colors uppercase tracking-wider block mx-auto pt-2"
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
    return (
      <div className="min-h-screen bg-[#07090e] text-white p-4 sm:p-6 lg:p-10 relative">
        {/* Ambient background glow */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-teal-500/8 blur-[160px] pointer-events-none -z-10" />

        <div className="container mx-auto max-w-6xl space-y-8 pt-4 pb-16">
          {/* Top Bar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-400">
                  Business Operations Console
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
                  serveq.tech/business
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Hub Command Center
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">
                Signed in as <span className="text-white font-bold">{user.name}</span> ({user.email}) &bull; Hub Owner
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRegisterHubOpen(true)}
                className="btn-island py-3 px-5 text-xs bg-teal-500 hover:bg-teal-400 text-zinc-950 font-black tracking-wider uppercase shadow-xl shadow-teal-500/20 flex items-center gap-2"
              >
                <span>+ Register New Hub</span>
                <span className="btn-bubble bg-zinc-950 text-teal-400">🏢</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
                <span>Active Hubs</span>
                <span>🏢</span>
              </div>
              <div className="text-3xl font-black text-white">{myBusinesses.length}</div>
              <p className="text-[11px] text-zinc-500">Registered venue locations</p>
            </div>

            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
                <span>Live Open Status</span>
                <span>⚡</span>
              </div>
              <div className="text-3xl font-black text-teal-400">
                {myBusinesses.filter(b => b.isOpen).length} / {myBusinesses.length}
              </div>
              <p className="text-[11px] text-zinc-500">Currently accepting queue entries</p>
            </div>

            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
                <span>Catalog Services</span>
                <span>📋</span>
              </div>
              <div className="text-3xl font-black text-indigo-400">
                {myBusinesses.reduce((acc, b) => acc + (b.services?.length || 0), 0)}
              </div>
              <p className="text-[11px] text-zinc-500">Configured offerings & pricing</p>
            </div>
          </div>

          {/* Hubs Listing */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Your Operational Hubs</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-extrabold border border-teal-500/30">
                  {myBusinesses.length}
                </span>
              </h2>
            </div>

            {fetchingHubs ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Loading Hub Nodes...</p>
              </div>
            ) : myBusinesses.length === 0 ? (
              <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl p-10 sm:p-14 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-3xl mx-auto">
                  🏢
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="text-xl font-black text-white tracking-tight">No Hubs Registered Yet</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    You are verified as a Hub Owner on serveq.tech! Create your first business hub to define your catalog of services, customize session durations and pricing, and launch your live queue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRegisterHubOpen(true)}
                  className="px-6 py-3 rounded-full bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-teal-500/20 active:scale-95 transition-all inline-flex items-center gap-2"
                >
                  <span>+ Deploy Your First Hub</span>
                  <span>✨</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {myBusinesses.map(b => (
                  <div
                    key={b._id}
                    className="bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-6 flex flex-col justify-between transition-all group hover:shadow-xl hover:shadow-teal-500/5"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-2xl shadow-sm">
                          {CATEGORY_METADATA[b.category]?.icon || '🏢'}
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          b.isOpen
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                          {b.isOpen ? '● LIVE QUEUE' : '○ CLOSED'}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-white tracking-tight group-hover:text-teal-300 transition-colors">
                          {b.name}
                        </h3>
                        <p className="text-xs text-zinc-400 line-clamp-2 mt-1">
                          {b.description || 'Enterprise queue operational hub'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                        <span className="font-semibold">{b.location || b.address || 'Urban Hub'}</span>
                        <span className="font-bold text-zinc-300">{b.services?.length || 0} services</span>
                      </div>
                    </div>

                    <div className="pt-6 space-y-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/business/${b._id}/manage`)}
                        className="w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-md shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <span>Launch Operations Console</span>
                        <span>→</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setManageServicesBiz(b)}
                          className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-[11px] uppercase tracking-wider transition-colors"
                        >
                          Services ({b.services?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/queue/${b._id}`)}
                          className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-[11px] uppercase tracking-wider transition-colors"
                        >
                          Queue View
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modals for Hub Registration and Service Management */}
        <RegisterHubModal
          isOpen={registerHubOpen}
          onClose={() => setRegisterHubOpen(false)}
          onCreated={(newBiz) => {
            setMyBusinesses(prev => [newBiz, ...prev])
            setRegisterHubOpen(false)
            toast.success(`Hub "${newBiz.name}" deployed successfully!`)
          }}
        />

        <ManageServicesModal
          isOpen={Boolean(manageServicesBiz)}
          business={manageServicesBiz}
          onClose={() => setManageServicesBiz(null)}
          onUpdated={(updatedBiz) => {
            setMyBusinesses(prev => prev.map(b => (b._id === updatedBiz._id ? updatedBiz : b)))
            setManageServicesBiz(null)
            toast.success('Services updated successfully!')
          }}
        />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: Unauthenticated Hub Owner Portal (serveq.tech/business)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#06080d] text-white selection:bg-teal-500 selection:text-black relative overflow-x-hidden flex flex-col justify-between">
      {/* Background radial glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-teal-500/10 blur-[150px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-10 w-[500px] h-[500px] bg-indigo-500/8 blur-[160px] pointer-events-none -z-10" />

      {/* Navigation Header */}
      <header className="border-b border-zinc-800/80 bg-black/40 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform overflow-hidden p-1">
              <img src="/logo.png" alt="serveQ" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white leading-none">serveQ</span>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Business
                </span>
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.25em] text-zinc-400 mt-0.5">
                Hub Owner Portal
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-text text-xs text-zinc-400 font-medium">
              Customer looking to join a queue?
            </span>
            <Link
              to="/login"
              className="text-xs font-bold px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-all no-underline"
            >
              Customer Portal →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="container mx-auto px-4 sm:px-6 py-10 sm:py-16 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center max-w-6xl mx-auto w-full">
          {/* Left Column: Value Prop for Hub Owners */}
          <div className="lg:col-span-7 space-y-8 text-left">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-300 text-xs font-black uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                Exclusively For Hub Owners &bull; serveq.tech/business
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.08]">
                Eliminate physical lines. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300">
                  Command live venue flow.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-zinc-400 font-medium leading-relaxed max-w-xl">
                The enterprise operational infrastructure engineered for restaurants, clinics, salons, banking branches, and high-volume retail. Sign up or log in below to deploy your hub.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-2xl p-4.5 space-y-1.5">
                <div className="text-teal-400 text-lg">⚡</div>
                <h2 className="text-sm font-bold text-white">Sub-10ms Live Counters</h2>
                <p className="text-xs text-zinc-400 leading-normal">
                  Call next tickets, auto-alert customers when their turn approaches, and sync across all devices in real-time.
                </p>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-2xl p-4.5 space-y-1.5">
                <div className="text-teal-400 text-lg">🧠</div>
                <h2 className="text-sm font-bold text-white">Neural Wait Predictions</h2>
                <p className="text-xs text-zinc-400 leading-normal">
                  Heuristic AI wait estimations minimize walkouts and calibrate customer arrival with counter velocity.
                </p>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-2xl p-4.5 space-y-1.5">
                <div className="text-teal-400 text-lg">💳</div>
                <h2 className="text-sm font-bold text-white">Escrow & Instant Deposits</h2>
                <p className="text-xs text-zinc-400 leading-normal">
                  Collect reservation deposits or session fees upfront via in-app wallet balances, slashing no-show rates.
                </p>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-2xl p-4.5 space-y-1.5">
                <div className="text-teal-400 text-lg">📊</div>
                <h2 className="text-sm font-bold text-white">Service Catalog Matrix</h2>
                <p className="text-xs text-zinc-400 leading-normal">
                  Configure custom session durations, pricing tiers, and technician availability per counter on demand.
                </p>
              </div>
            </div>

            {/* Industry Venue Tags */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 mr-2">
                Supported Venues:
              </span>
              {['Dining & Cafes', 'Medical Clinics', 'Salons & Spas', 'Banking Centers', 'Retail Boutiques'].map(t => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] font-semibold"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right Column: Dedicated Hub Owner Authentication Box */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-[2rem] p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
              {/* Subtle accent border at top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-400 to-indigo-500" />

              {/* Portal Header */}
              <div className="text-center space-y-1.5 mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[10px] font-black uppercase tracking-wider mb-2">
                  <span>🏢</span> Hub Owner Portal
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  {authTab === 'signin' ? 'Hub Owner Sign In' : 'Hub Owner Registration'}
                </h2>
                <p className="text-xs text-zinc-400 font-medium">
                  {authTab === 'signin'
                    ? 'Access your venue queues and operations terminal'
                    : 'Create a verified Hub Owner account on serveQ'}
                </p>
              </div>

              {/* Tab Selector: Sign In vs Sign Up */}
              <div className="flex bg-black/60 p-1 rounded-full border border-zinc-800 mb-6">
                <button
                  type="button"
                  onClick={() => { setAuthTab('signin'); setCustomerMismatch(null) }}
                  className={`flex-1 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                    authTab === 'signin'
                      ? 'bg-teal-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('signup'); setCustomerMismatch(null) }}
                  className={`flex-1 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                    authTab === 'signup'
                      ? 'bg-teal-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Mismatch Alert for Customer Accounts */}
              <AnimatePresence>
                {customerMismatch && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-5 overflow-hidden"
                  >
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-3">
                      <div className="flex items-start gap-2.5">
                        <span className="text-base">⚠️</span>
                        <div>
                          <p className="font-bold text-white">Hub Owner Verification Required</p>
                          <p className="text-[11px] text-amber-200/90 mt-0.5">
                            This email is currently registered with a Customer role. Only Hub Owners can sign in to this portal.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 pt-1">
                        <Link
                          to="/login"
                          className="w-full py-2 px-3 text-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[11px] uppercase tracking-wider no-underline"
                        >
                          Sign In at Customer Portal (/login)
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hub Owner Authentication Form */}
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <AnimatePresence mode="wait">
                  {authTab === 'signup' && (
                    <motion.div
                      key="signup-extra-fields"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5 block">
                          Full Name
                        </label>
                        <input
                          type="text"
                          name="name"
                          required
                          value={form.name}
                          onChange={onChange}
                          placeholder="Alex Morgan"
                          className="w-full px-4 py-3 rounded-xl bg-black/60 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-teal-500 transition-colors"
                        />
                      </div>

                      {/* Locked Role Notification */}
                      <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium">Assigned Operational Role:</span>
                        <span className="px-2 py-0.5 rounded-md bg-teal-400 text-zinc-950 font-black text-[10px] uppercase tracking-wider">
                          Hub Owner
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5 block">
                    Work Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={form.email}
                    onChange={onChange}
                    placeholder="owner@yourvenue.com"
                    className="w-full px-4 py-3 rounded-xl bg-black/60 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5 block">
                    Security Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      value={form.password}
                      onChange={onChange}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-xl bg-black/60 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-teal-500 transition-colors pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                    >
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <span>
                    {loading
                      ? 'Authenticating...'
                      : authTab === 'signin'
                      ? 'Sign In to Hub Console'
                      : 'Register as Hub Owner'}
                  </span>
                  <span>→</span>
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-extrabold">
                  <span className="bg-zinc-900 px-3 text-zinc-500">or single sign-on</span>
                </div>
              </div>

              {/* Google OAuth (Hub Owner role strictly attached) */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                className="w-full py-3 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.1 8.8 5 12 5z" />
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
                  <path fill="#FBBC05" d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.6 7.4C.6 9.4 0 10.6 0 12s.6 2.6 1.6 4.6l3.7-1.8z" />
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.2 0-5.8-2.1-6.7-5.2L1.6 16c1.9 3.8 5.8 7 10.4 7z" />
                </svg>
                <span>Continue with Google (Hub Owner)</span>
              </button>

              {/* Notice */}
              <p className="mt-5 text-center text-[10px] text-zinc-500 font-medium leading-relaxed">
                By entering, you confirm you are authorized to manage or create commercial venues on serveQ.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 bg-black/60">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            &copy; {new Date().getFullYear()} serveQ Infrastructure. Enterprise Venue Command.
          </div>
          <div className="flex items-center gap-6">
            <Link to="/" className="hover:text-zinc-300 transition-colors no-underline">
              Customer Home
            </Link>
            <Link to="/login" className="hover:text-zinc-300 transition-colors no-underline">
              Customer Login
            </Link>
            <span className="text-teal-400 font-mono text-[11px]">serveq.tech/business</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
