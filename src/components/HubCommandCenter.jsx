import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getMyBusinesses } from '../api/business.api'
import { toast } from 'react-hot-toast'
import RegisterHubModal from './RegisterHubModal'
import ManageServicesModal from './ManageServicesModal'
import {
  Building2,
  Users,
  Radio,
  Clock,
  Sparkles,
  Plus,
  Search,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Store,
  Wallet,
  HelpCircle,
  LogOut,
  User,
  CheckCircle2,
  Layers,
  ArrowRight,
  SlidersHorizontal,
  Lock,
  Compass,
  AlertTriangle,
} from 'lucide-react'

export default function HubCommandCenter() {
  const { user, logOut } = useAuth()
  const { onBusinessStatus } = useSocket()
  const navigate = useNavigate()

  const [myBusinesses, setMyBusinesses] = useState([])
  const [fetchingHubs, setFetchingHubs] = useState(true)
  const [registerHubOpen, setRegisterHubOpen] = useState(false)
  const [manageServicesBiz, setManageServicesBiz] = useState(null)

  // Layout & Navigation State
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'live' | 'onboarding' | 'closed'
  const [searchQuery, setSearchQuery] = useState('')

  // Email verification check
  const isEmailVerified = Boolean(user?.isEmailVerified || user?.authProvider === 'google')

  const handleRegisterHubClick = () => {
    if (!isEmailVerified) {
      toast.error('Email verification required! Please verify your email before onboarding.')
    }
    navigate('/business/onboarding')
  }

  const loadHubs = useCallback(async () => {
    setFetchingHubs(true)
    try {
      const res = await getMyBusinesses()
      setMyBusinesses(res.data.data.businesses || [])
    } catch (err) {
      console.error('Failed to load hubs:', err)
    } finally {
      setFetchingHubs(false)
    }
  }, [])

  useEffect(() => {
    loadHubs()
  }, [loadHubs])

  // Real-time status sync for hubs
  useEffect(() => {
    const unsub = onBusinessStatus?.((data) => {
      setMyBusinesses((prev) =>
        prev.map((b) =>
          b._id === data.businessId
            ? { ...b, isOpen: data.isOpen, isActive: data.isActive }
            : b
        )
      )
    })
    return () => unsub?.()
  }, [onBusinessStatus])

  // Summary Counts
  const openCount = useMemo(() => myBusinesses.filter((b) => b.isOpen).length, [myBusinesses])
  const onboardingCount = useMemo(
    () => myBusinesses.filter((b) => b.onboarding?.status === 'IN_PROGRESS').length,
    [myBusinesses]
  )
  const closedCount = useMemo(
    () => myBusinesses.filter((b) => !b.isOpen && b.onboarding?.status !== 'IN_PROGRESS').length,
    [myBusinesses]
  )
  const totalServices = useMemo(
    () => myBusinesses.reduce((acc, b) => acc + (b.services?.length || 0), 0),
    [myBusinesses]
  )

  // Filtered Hubs
  const filteredHubs = useMemo(() => {
    return myBusinesses.filter((b) => {
      const matchesSearch =
        !searchQuery.trim() ||
        b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.location?.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      if (activeFilter === 'live') return Boolean(b.isOpen)
      if (activeFilter === 'onboarding') return b.onboarding?.status === 'IN_PROGRESS'
      if (activeFilter === 'closed') return !b.isOpen && b.onboarding?.status !== 'IN_PROGRESS'
      return true
    })
  }, [myBusinesses, activeFilter, searchQuery])

  // Common Sidebar Content
  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full space-y-6">
      <div className="space-y-6">
        {/* Network Identity Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border border-[#BDE8CB] shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#114227] text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs">
              <Building2 className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-xs text-zinc-950 truncate leading-tight">
                Hub Operations
              </h3>
              <p className="text-[10px] text-zinc-500 font-medium truncate capitalize">
                {myBusinesses.length} {myBusinesses.length === 1 ? 'Venue Node' : 'Venue Nodes'} Registered
              </p>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#BDE8CB]/60 flex items-center justify-between text-[11px]">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Network Status
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
              <span>{openCount} / {myBusinesses.length} Live</span>
            </span>
          </div>
        </div>

        {/* Section 1: Command Filters & Views */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1">
            Command Views
          </p>
          {[
            {
              id: 'all',
              label: 'All Operational Hubs',
              icon: Building2,
              count: myBusinesses.length,
            },
            {
              id: 'live',
              label: 'Live & Accepting',
              icon: Radio,
              count: openCount,
              badgeHighlight: openCount > 0,
            },
            {
              id: 'onboarding',
              label: 'Setup In Progress',
              icon: Sparkles,
              count: onboardingCount,
              badgeWarning: onboardingCount > 0,
            },
            {
              id: 'closed',
              label: 'Inactive / Closed',
              icon: Lock,
              count: closedCount,
            },
          ].map((item) => {
            const isActive = activeFilter === item.id
            const IconComponent = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveFilter(item.id)
                  if (isMobile) setMobileSidebarOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#EAF5EC] text-[#114227] shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#114227]' : 'text-zinc-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                      isActive
                        ? 'bg-[#114227] text-white'
                        : item.badgeHighlight
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : item.badgeWarning
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Section 2: Direct Hub Quick-Access (List user's venues) */}
        {myBusinesses.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between px-3 py-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Direct Venue Consoles
              </p>
              <span className="text-[10px] font-bold text-zinc-400">
                {myBusinesses.length}
              </span>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {myBusinesses.map((b) => {
                const isInProgress = b.onboarding?.status === 'IN_PROGRESS'
                return (
                  <button
                    key={b._id}
                    type="button"
                    onClick={() => {
                      if (isInProgress) {
                        navigate(`/business/onboarding/${b._id}`)
                      } else {
                        navigate(`/business/${b._id}/manage`)
                      }
                      if (isMobile) setMobileSidebarOpen(false)
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-zinc-100 group-hover:bg-[#EAF5EC] group-hover:text-[#114227] text-zinc-700 font-black text-[10px] flex items-center justify-center shrink-0 transition-colors">
                        {b.name?.[0] || 'H'}
                      </span>
                      <span className="truncate text-xs font-bold">{b.name}</span>
                    </div>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isInProgress
                          ? 'bg-amber-400'
                          : b.isOpen
                          ? 'bg-emerald-500 ring-2 ring-emerald-200'
                          : 'bg-zinc-300'
                      }`}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Section 3: Platform Navigation & Views */}
        <div className="space-y-1 pt-2 border-t border-zinc-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1">
            Navigate & Views
          </p>

          {/* Customer Portal */}
          <button
            type="button"
            onClick={() => {
              navigate('/customers')
              if (isMobile) setMobileSidebarOpen(false)
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Store className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="truncate">Customer Portal</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* Venue Wallet */}
          <button
            type="button"
            onClick={() => {
              navigate('/wallet')
              if (isMobile) setMobileSidebarOpen(false)
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Wallet className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="truncate">Venue Wallet</span>
            </div>
            <span className="text-[10px] font-bold text-[#114227] bg-[#EAF7EE] px-2 py-0.5 rounded-full border border-[#BDE8CB]">
              ₹{(user?.walletBalance ?? 0).toLocaleString()}
            </span>
          </button>

          {/* Onboarding Wizard Action */}
          <button
            type="button"
            onClick={() => {
              handleRegisterHubClick()
              if (isMobile) setMobileSidebarOpen(false)
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="truncate">Register New Hub</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
          </button>
        </div>
      </div>

      {/* Bottom Sidebar: User snapshot, Help & Logout */}
      <div className="pt-4 border-t border-zinc-100 space-y-1">
        {/* User Card */}
        <button
          type="button"
          onClick={() => {
            navigate('/profile')
            if (isMobile) setMobileSidebarOpen(false)
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-zinc-100/80 transition-colors cursor-pointer text-left"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'O'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-zinc-900 truncate">{user?.name || 'Hub Owner'}</p>
            <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/support')}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-zinc-500" />
          <span>Help & Support</span>
        </button>

        <button
          type="button"
          onClick={() => {
            logOut()
            navigate('/login')
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-rose-500" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-zinc-900 flex flex-col font-sans">
      {/* ── TOP STICKY HEADER BAR ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Mobile Menu Toggle + ServeQ Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/business" className="flex items-center gap-2.5 text-decoration-none group">
            <img
              src="/serveq-logo.png"
              alt="serveQ"
              className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="hidden sm:inline-block text-[9px] font-black uppercase tracking-[0.2em] text-[#114227] bg-[#EAF7EE] px-2 py-0.5 rounded-full border border-[#BDE8CB]">
              Enterprise
            </span>
          </Link>
        </div>

        {/* Center: Network Details Pill */}
        <div className="hidden md:flex items-center gap-3 bg-zinc-50/80 border border-zinc-200/70 px-4 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-xs text-zinc-900">
            Network Command
          </span>
          <span className="text-zinc-300">•</span>
          <span className="text-xs font-semibold text-zinc-600">
            {myBusinesses.length} {myBusinesses.length === 1 ? 'Location' : 'Locations'}
          </span>
          <span className="text-zinc-300">•</span>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
            {openCount} Live Now
          </span>
        </div>

        {/* Right: Actions (+ Register New Hub, Wallet, Profile) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Register New Hub */}
          <button
            type="button"
            onClick={handleRegisterHubClick}
            className="px-4 py-1.5 rounded-full bg-[#114227] hover:bg-[#0D361F] text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Register New Hub</span>
            <span className="sm:hidden">New Hub</span>
          </button>

          {/* Wallet */}
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="hidden sm:flex px-3.5 py-1.5 rounded-full bg-[#EAF7EE] border border-[#BDE8CB] hover:bg-[#DDF3E3] text-xs font-bold text-[#114227] items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5 text-[#114227]" />
            <span>₹{(user?.walletBalance ?? 0).toLocaleString()}</span>
          </button>

          {/* Profile Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="flex items-center gap-1.5 p-1 pl-1.5 pr-2 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-700 text-white flex items-center justify-center font-bold text-xs border border-zinc-200">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'O'}
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {showUserMenu && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-white border border-zinc-200 rounded-2xl shadow-xl p-1.5 z-50 space-y-1">
                <div className="px-3 py-2 border-b border-zinc-100">
                  <p className="text-xs font-bold text-zinc-900 truncate">{user?.name || 'Hub Owner'}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/profile')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Account Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/customers')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Customer Portal</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/wallet')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Wallet & Payouts</span>
                </button>
                <div className="border-t border-zinc-100 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    logOut()
                    navigate('/login')
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── BODY: SIDEBAR + MAIN CANVAS ── */}
      <div className="flex-1 flex w-full">
        {/* Desktop Left Sidebar */}
        <aside className="w-64 shrink-0 hidden lg:flex flex-col justify-between py-5 px-4 border-r border-zinc-200/70 min-h-[calc(100vh-61px)] bg-white/60 backdrop-blur-xs sticky top-[61px] self-start max-h-[calc(100vh-61px)] overflow-y-auto">
          {renderSidebarContent(false)}
        </aside>

        {/* Mobile Slide-Over Drawer */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileSidebarOpen(false)}
                className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs z-50 lg:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed inset-y-0 left-0 w-72 bg-white z-50 p-5 flex flex-col justify-between shadow-2xl lg:hidden overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-2">
                  <div className="flex items-center gap-2">
                    <img src="/serveq-logo.png" alt="serveQ" className="h-6 w-auto" />
                    <span className="text-[10px] font-black uppercase text-[#114227] bg-[#EAF7EE] px-2 py-0.5 rounded-full border border-[#BDE8CB]">
                      Menu
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {renderSidebarContent(true)}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full">
          {/* Top Title Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 pb-6 text-left">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#114227]">
                  Business Operations Console
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF7EE] text-[#114227] border border-[#BDE8CB]">
                  serveq.tech/business
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
                Hub Command Center
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium">
                Signed in as <span className="text-zinc-900 font-bold">{user?.name}</span> ({user?.email}) &bull; Hub Owner
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRegisterHubClick}
                className="px-5 py-2.5 rounded-full bg-[#114227] hover:bg-[#0D361F] text-white font-black text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Register New Hub</span>
              </button>
            </div>
          </div>

          {/* Email Verification Required Banner if unverified */}
          {!isEmailVerified && (
            <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent border-2 border-amber-300 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Verification Required
                  </span>
                  <h3 className="text-base font-black text-zinc-950 mt-1">
                    Email verification is required before onboarding new venues
                  </h3>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    Your account email <span className="font-bold text-zinc-900">{user?.email}</span> must be verified with an OTP before you can register new hubs or resume setup.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <span>Verify Email (OTP)</span>
                <span>→</span>
              </button>
            </div>
          )}

          {/* In-Progress Onboarding Notification Banner */}
          {myBusinesses.some((b) => b.onboarding?.status === 'IN_PROGRESS') && (
            <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border border-amber-300/80 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left shadow-2xs">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
                  SETUP
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Setup In Progress
                  </span>
                  <h3 className="text-base font-black text-zinc-950 mt-1">
                    You have an unfinished business onboarding session
                  </h3>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    Complete all 7 steps to launch your venue live onto the ServeQ discovery network.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const inProgress = myBusinesses.find((b) => b.onboarding?.status === 'IN_PROGRESS')
                  navigate(`/business/onboarding${inProgress ? `/${inProgress._id}` : ''}`)
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all self-start sm:self-auto flex items-center gap-1.5 cursor-pointer"
              >
                <span>Resume Onboarding Setup</span>
                <span>→</span>
              </button>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider">
                <span>Active Hubs</span>
              </div>
              <div className="text-3xl font-black text-zinc-950">{myBusinesses.length}</div>
              <p className="text-[11px] text-zinc-500 font-medium">Registered venue locations</p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider">
                <span>Live Open Status</span>
              </div>
              <div className="text-3xl font-black text-[#16A34A]">
                {openCount} / {myBusinesses.length}
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">Currently accepting queue entries</p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider">
                <span>Catalog Services</span>
              </div>
              <div className="text-3xl font-black text-indigo-600">
                {totalServices}
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">Configured offerings & pricing</p>
            </div>
          </div>

          {/* Hubs Listing Header + Search */}
          <div className="space-y-4 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
                  <span>Your Operational Hubs</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EAF7EE] text-[#114227] font-extrabold border border-[#BDE8CB]">
                    {filteredHubs.length}
                  </span>
                </h2>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search your hubs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-full focus:outline-none focus:border-[#114227] text-zinc-800 placeholder:text-zinc-400"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All Hubs', count: myBusinesses.length },
                { id: 'live', label: 'Live Now', count: openCount },
                { id: 'onboarding', label: 'Setup In Progress', count: onboardingCount },
                { id: 'closed', label: 'Closed', count: closedCount },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setActiveFilter(pill.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeFilter === pill.id
                      ? 'bg-[#114227] text-white shadow-xs'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  {pill.label} ({pill.count})
                </button>
              ))}
            </div>

            {fetchingHubs ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Loading Hub Nodes...</p>
              </div>
            ) : filteredHubs.length === 0 ? (
              <div className="bg-white border border-dashed border-zinc-300 rounded-3xl p-10 sm:p-14 text-center space-y-4 shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center font-black text-emerald-800 text-sm mx-auto shadow-xs">
                  <Building2 className="w-7 h-7 text-emerald-700" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="text-xl font-black text-zinc-950 tracking-tight">
                    {searchQuery ? 'No matching hubs found' : 'No Hubs Registered Yet'}
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-normal">
                    {searchQuery
                      ? `No venues matched "${searchQuery}". Clear your search query to see all hubs.`
                      : 'You are verified as a Hub Owner on serveq.tech! Start the guided 7-step onboarding wizard to establish your venue profile, configure operating hours, build your service catalog, and go live.'}
                  </p>
                </div>
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold"
                  >
                    Clear Search
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/business/onboarding')}
                    className="px-6 py-3 rounded-full bg-[#114227] hover:bg-[#0D361F] text-white text-xs font-black uppercase tracking-wider shadow-sm hover:shadow active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <span>+ Start Guided Business Onboarding</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredHubs.map((b) => {
                  const isInProgress = b.onboarding?.status === 'IN_PROGRESS'

                  return (
                    <div
                      key={b._id}
                      className="bg-white border border-zinc-200/80 hover:border-zinc-300 rounded-3xl p-6 flex flex-col justify-between transition-all group shadow-xs hover:shadow-md text-left"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-center font-black text-[#114227] text-sm shadow-xs">
                            {b.name?.[0] || 'H'}
                          </div>
                          {isInProgress ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-200">
                              STEP {b.onboarding?.currentStep || 1} IN PROGRESS
                            </span>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                b.isOpen
                                  ? 'bg-[#EAF7EE] text-[#16A34A] border-[#CDEBD4]'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {b.isOpen ? 'LIVE QUEUE' : 'CLOSED'}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-lg font-black text-zinc-950 tracking-tight group-hover:text-emerald-700 transition-colors">
                            {b.name}
                          </h3>
                          <p className="text-xs text-zinc-500 line-clamp-2 mt-1">
                            {b.description || 'Enterprise queue operational hub'}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 font-medium">
                          <span>{b.location || b.address || 'Urban Hub'}</span>
                          <span className="font-bold text-zinc-700">{b.services?.length || 0} services</span>
                        </div>
                      </div>

                      <div className="pt-6 space-y-2">
                        {isInProgress ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/business/onboarding/${b._id}`)}
                            className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <span>Resume Onboarding Wizard</span>
                            <span>→</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/business/${b._id}/manage`)}
                            className="w-full py-3 px-4 rounded-xl bg-[#114227] hover:bg-[#0D361F] text-white font-black text-xs uppercase tracking-wider shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <span>Launch Operations Console</span>
                            <span>→</span>
                          </button>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setManageServicesBiz(b)}
                            className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/70 text-zinc-800 font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Services ({b.services?.length || 0})
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/queue/${b._id}`)}
                            className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/70 text-zinc-800 font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Queue View
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals for Hub Registration and Service Management */}
      <RegisterHubModal
        isOpen={registerHubOpen}
        onClose={() => setRegisterHubOpen(false)}
        onCreated={(newBiz) => {
          setMyBusinesses((prev) => [newBiz, ...prev])
          setRegisterHubOpen(false)
          toast.success(`Hub "${newBiz.name}" deployed successfully!`)
        }}
      />

      <ManageServicesModal
        isOpen={Boolean(manageServicesBiz)}
        business={manageServicesBiz}
        onClose={() => setManageServicesBiz(null)}
        onUpdated={(updatedBiz) => {
          setMyBusinesses((prev) =>
            prev.map((b) => (b._id === updatedBiz._id ? updatedBiz : b))
          )
          setManageServicesBiz(null)
          toast.success('Services updated successfully!')
        }}
      />
    </div>
  )
}
