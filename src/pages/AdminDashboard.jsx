import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import axios from '../api/axios'
import { signin } from '../api/auth.api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useSeo } from '../utils/useSeo'
import { isValidEmail } from '../utils/validators'
import { useDebounce } from '../hooks/useDebounce'
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
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Activity,
  RefreshCw,
  Trash2,
  Copy,
  Download,
  AlertTriangle,
  Check,
  TrendingUp,
  Calendar,
  Eye,
  EyeOff,
} from 'lucide-react'

// ─── Embedded Admin Login View ──────────────────────────────────
function AdminLoginForm({ onLoginSuccess }) {
  const { user, logOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // const handleFillDemo = () => {
  //   setEmail('admin@serveq.tech')
  //   setPassword('admin123')
  // }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter admin email and password')
      return
    }

    if (!isValidEmail(email.trim())) {
      toast.error('Please enter a valid email address (e.g. admin@serveq.tech)')
      return
    }

    setLoading(true)
    try {
      const res = await signin({
        email: email.trim(),
        password,
        requiredRole: 'admin',
      })
      toast.success('Admin authentication successful! Access granted.')
      onLoginSuccess(res.data.data.user, res.data.data.token)
    } catch (err) {
      const msg = err.response?.data?.message || 'Admin authentication failed. Please verify credentials.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAF9] font-sans selection:bg-emerald-500/20 selection:text-emerald-900">
      <div className="w-full max-w-md bg-white border border-zinc-200/90 rounded-3xl p-8 sm:p-10 shadow-xl space-y-6 text-left">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF7EE] border border-[#BDE8CB] text-[#114227] text-[11px] font-black uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            Global Control Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 uppercase tracking-tight">
            Admin <span className="text-[#114227]">Login</span>
          </h1>
          <p className="text-xs text-zinc-500 leading-relaxed font-medium">
            Secure administrative gateway for monitoring live venues, presence, and platform operations.
          </p>
        </div>

        {/* Existing Session Alert if non-admin */}
        {user && user.role !== 'admin' && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
            <p className="font-bold flex items-center gap-1.5">
              Logged in as: {user.name} ({user.role})
            </p>
            <p className="text-[11px] text-amber-800">
              Administrator privileges are required for this area. Enter administrative credentials below to upgrade this session or switch accounts.
            </p>
            <button
              type="button"
              onClick={logOut}
              className="text-[11px] font-black underline text-amber-950 hover:text-black cursor-pointer"
            >
              Sign out of current account
            </button>
          </div>
        )}

        {/* Quick Fill Demo Helper */}
        {/* <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-bold text-zinc-900">Default Superadmin</p>
            <p className="text-[11px] text-zinc-500 font-mono">admin@serveq.tech • admin123</p>
          </div>
          <button
            type="button"
            onClick={handleFillDemo}
            className="px-3 py-1.5 bg-[#114227] hover:bg-[#0D361F] text-white rounded-xl text-xs font-bold transition shadow-xs whitespace-nowrap cursor-pointer"
          >
            Auto-Fill
          </button>
        </div> */}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="enter admin email"
              className="w-full px-4 py-2.5 rounded-2xl border border-zinc-200 focus:outline-none focus:border-[#114227] text-xs font-medium bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Master Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 pr-10 rounded-2xl border border-zinc-200 focus:outline-none focus:border-[#114227] text-xs font-medium bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors p-1 cursor-pointer flex items-center justify-center"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#114227] hover:bg-[#0D361F] disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Unlock Admin Dashboard →'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user, loading: authLoading, logIn, logOut } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()

  useSeo({
    title: 'Admin Command Console — serveQ',
    description: 'System-wide telemetry, user monitoring, and hub moderation.',
    robots: 'noindex, nofollow',
  })

  // Telemetry state
  const [stats, setStats] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [usersList, setUsersList] = useState([])
  const [prelaunchCustomers, setPrelaunchCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Layout state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Active Tab: 'hubs' | 'customers' | 'prelaunch'
  const [activeTab, setActiveTab] = useState('hubs')

  // Search & Filters
  const [hubSearch, setHubSearch] = useState('')
  const [hubFilter, setHubFilter] = useState('all') // 'all' | 'online' | 'approved' | 'suspended'

  const [userSearch, setUserSearch] = useState('')
  const [userFilter, setUserFilter] = useState('all') // 'all' | 'online' | 'in_queue' | 'customer' | 'owner'

  const [prelaunchSearch, setPrelaunchSearch] = useState('')
  const [prelaunchFilter, setPrelaunchFilter] = useState('all') // 'all' | 'email_sent' | 'email_pending'

  const debouncedHubSearch = useDebounce(hubSearch, 350)
  const debouncedUserSearch = useDebounce(userSearch, 350)
  const debouncedPrelaunchSearch = useDebounce(prelaunchSearch, 350)

  // Detail Modal & Remove Hub Confirmation Modal
  const [selectedBusinessDetail, setSelectedBusinessDetail] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [hubToDelete, setHubToDelete] = useState(null)
  const [deletingHub, setDeletingHub] = useState(false)

  const [customerToDelete, setCustomerToDelete] = useState(null)
  const [deletingCustomer, setDeletingCustomer] = useState(false)

  // Fetch telemetry from API
  const fetchAdminData = useCallback(async (silent = false) => {
    if (!user || user.role !== 'admin') return
    if (!silent) setLoading(true)

    try {
      const [statsRes, bizRes, usersRes, prelaunchRes] = await Promise.all([
        axios.get('/admin/stats'),
        axios.get('/admin/businesses', { params: { search: debouncedHubSearch } }),
        axios.get('/admin/users', { params: { search: debouncedUserSearch } }),
        axios.get('/admin/prelaunch-customers', { params: { search: debouncedPrelaunchSearch } }),
      ])

      setStats(statsRes.data.data)
      setBusinesses(bizRes.data.data.businesses || [])
      setUsersList(usersRes.data.data.users || [])
      setPrelaunchCustomers(prelaunchRes.data.data.customers || [])
    } catch {
      if (!silent) toast.error('Failed to load administration data')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user, debouncedHubSearch, debouncedUserSearch, debouncedPrelaunchSearch])

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAdminData()
    }
  }, [user, fetchAdminData])

  // Periodic Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !user || user.role !== 'admin') return
    const interval = setInterval(() => {
      fetchAdminData(true)
    }, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, user, fetchAdminData])

  // Real-time socket events sync
  useEffect(() => {
    if (!socket || !user || user.role !== 'admin') return

    const handleSync = () => {
      fetchAdminData(true)
    }

    socket.on('business:status', handleSync)
    socket.on('business:deleted', handleSync)
    socket.on('queue:update', handleSync)
    socket.on('queue:joined', handleSync)
    socket.on('queue:left', handleSync)

    return () => {
      socket.off('business:status', handleSync)
      socket.off('business:deleted', handleSync)
      socket.off('queue:update', handleSync)
      socket.off('queue:joined', handleSync)
      socket.off('queue:left', handleSync)
    }
  }, [socket, user, fetchAdminData])

  // Moderation Handler
  const handleModerate = async (id, action) => {
    try {
      const res = await axios.patch(`/admin/business/${id}/moderate`, { action })
      toast.success(res.data.message || `Action ${action} succeeded`)
      fetchAdminData(true)
      if (selectedBusinessDetail?.business?._id === id) {
        viewBusinessDetails(id)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Moderation action failed')
    }
  }

  // Remove Hub Handler (Permanent)
  const confirmDeleteBusiness = async () => {
    if (!hubToDelete) return
    setDeletingHub(true)
    try {
      await axios.delete(`/admin/business/${hubToDelete._id}`)
      toast.success(`Hub "${hubToDelete.name}" permanently removed`)
      setHubToDelete(null)
      setDetailModalOpen(false)
      fetchAdminData(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove hub')
    } finally {
      setDeletingHub(false)
    }
  }

  const viewBusinessDetails = async (id) => {
    setLoadingDetail(true)
    setDetailModalOpen(true)
    try {
      const res = await axios.get(`/admin/business/${id}`)
      setSelectedBusinessDetail(res.data.data)
    } catch {
      toast.error('Failed to fetch business details')
      setDetailModalOpen(false)
    } finally {
      setLoadingDetail(false)
    }
  }

  // Check auth state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="w-12 h-12 border-4 border-[#114227] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // If unauthenticated or non-admin, render Admin Login Form directly
  if (!user || user.role !== 'admin') {
    return (
      <AdminLoginForm
        onLoginSuccess={(userData, token) => {
          logIn(userData, token)
        }}
      />
    )
  }

  // Prelaunch Customer Handlers
  const confirmDeletePrelaunchCustomer = async () => {
    if (!customerToDelete) return
    setDeletingCustomer(true)
    try {
      await axios.delete(`/admin/prelaunch-customers/${customerToDelete._id}`)
      toast.success(`Prelaunch customer "${customerToDelete.email}" removed`)
      setCustomerToDelete(null)
      fetchAdminData(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove prelaunch customer')
    } finally {
      setDeletingCustomer(false)
    }
  }

  const exportPrelaunchCSV = () => {
    if (!filteredPrelaunchCustomers || filteredPrelaunchCustomers.length === 0) {
      toast.error('No prelaunch customers to export')
      return
    }

    const headers = ['Email', 'Status', 'Confirmation Email Sent', 'Confirmation Message ID', 'Source', 'IP Address', 'Registered At']
    const rows = filteredPrelaunchCustomers.map((c) => [
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.status || 'confirmed').replace(/"/g, '""')}"`,
      c.confirmationEmailSent ? 'Yes' : 'No',
      `"${(c.confirmationMessageId || '').replace(/"/g, '""')}"`,
      `"${(c.source || 'coming_soon_landing').replace(/"/g, '""')}"`,
      `"${(c.ip || '').replace(/"/g, '""')}"`,
      `"${new Date(c.createdAt).toISOString()}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `serveq-prelaunch-customers-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredPrelaunchCustomers.length} prelaunch customers to CSV`)
  }

  const copyAllPrelaunchEmails = () => {
    if (!filteredPrelaunchCustomers || filteredPrelaunchCustomers.length === 0) {
      toast.error('No emails to copy')
      return
    }
    const emails = filteredPrelaunchCustomers.map((c) => c.email).join(', ')
    navigator.clipboard.writeText(emails)
    toast.success(`Copied ${filteredPrelaunchCustomers.length} emails to clipboard!`)
  }

  const copySingleEmail = (email) => {
    navigator.clipboard.writeText(email)
    toast.success(`Copied ${email}`)
  }

  // Filter Hubs
  const filteredBusinesses = businesses.filter((b) => {
    if (hubFilter === 'all') return true
    if (hubFilter === 'online') return b.isOnline
    if (hubFilter === 'approved') return b.approvalStatus === 'approved' && b.isActive
    if (hubFilter === 'suspended') return b.approvalStatus === 'suspended' || !b.isActive
    return true
  })

  // Filter Customers / Users
  const filteredUsers = usersList.filter((u) => {
    if (userFilter === 'all') return true
    if (userFilter === 'online') return u.isOnline
    if (userFilter === 'in_queue') return Boolean(u.activeQueue)
    if (userFilter === 'customer') return u.role === 'customer'
    if (userFilter === 'owner') return u.role === 'owner'
    return true
  })

  // Filter Prelaunch Customers
  const filteredPrelaunchCustomers = prelaunchCustomers.filter((c) => {
    if (prelaunchFilter === 'all') return true
    if (prelaunchFilter === 'email_sent') return c.confirmationEmailSent
    if (prelaunchFilter === 'email_pending') return !c.confirmationEmailSent
    return true
  })

  const onlineHubsCount = stats?.stats?.onlineHubs ?? businesses.filter((b) => b.isOnline).length
  const onlineUsersCount = stats?.stats?.onlineUsers ?? usersList.filter((u) => u.isOnline).length

  // Common Sidebar Renderer
  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full space-y-6 text-left">
      <div className="space-y-6">
        {/* Admin Identity Card in Sidebar */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 via-emerald-50/40 to-white border border-purple-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs">
              <ShieldAlert className="w-5 h-5 text-purple-200" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-xs text-zinc-950 truncate leading-tight">
                Root Admin Hub
              </h3>
              <p className="text-[10px] text-purple-700 font-bold truncate uppercase tracking-wider">
                Superuser Console
              </p>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-purple-100 flex items-center justify-between text-[11px]">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Network Status
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
              <span>LIVE TELEMETRY</span>
            </span>
          </div>
        </div>

        {/* Section 1: Command Operations Tabs */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1">
            Operations Console
          </p>
          {[
            {
              id: 'hubs',
              label: 'Hubs & Operations',
              icon: Building2,
              count: businesses.length,
              badgeHighlight: onlineHubsCount > 0,
            },
            {
              id: 'customers',
              label: 'Customers & Presence',
              icon: Users,
              count: usersList.length,
              badgeHighlight: onlineUsersCount > 0,
            },
            {
              id: 'prelaunch',
              label: 'Prelaunch Waitlist',
              icon: Sparkles,
              count: prelaunchCustomers.length,
            },
          ].map((item) => {
            const isActive = activeTab === item.id
            const IconComponent = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id)
                  if (isMobile) setMobileSidebarOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${isActive
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
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${isActive
                      ? 'bg-[#114227] text-white'
                      : item.badgeHighlight
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
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

        {/* Section 2: Platform Navigation Views */}
        <div className="space-y-1 pt-2 border-t border-zinc-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1">
            Navigate & Views
          </p>

          <button
            type="button"
            onClick={() => {
              navigate('/business')
              if (isMobile) setMobileSidebarOpen(false)
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Store className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="truncate">Hubs Console</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              navigate('/customers')
              if (isMobile) setMobileSidebarOpen(false)
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Users className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="truncate">Customer Portal</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              navigate('/profile')
              if (isMobile) setMobileSidebarOpen(false)
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <User className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="truncate">Admin Profile</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
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
          <div className="w-8 h-8 rounded-full bg-purple-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-zinc-900 truncate">{user?.name || 'Administrator'}</p>
            <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/support')}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-zinc-500" />
          <span>Ops Help & Support</span>
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
    <div className="min-h-screen bg-[#F8FAF9] text-zinc-900 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900">
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

          <Link to="/admin" className="flex items-center gap-2.5 text-decoration-none group">
            <img
              src="/serveq-logo.png"
              alt="serveQ"
              className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="hidden sm:inline-block text-[9px] font-black uppercase tracking-[0.2em] text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              Admin Portal
            </span>
          </Link>
        </div>

        {/* Center: Live Telemetry Pill */}
        <div className="hidden md:flex items-center gap-3 bg-zinc-50/80 border border-zinc-200/70 px-4 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-xs text-zinc-900">
            Realtime Telemetry
          </span>
          <span className="text-zinc-300">•</span>
          <span className="text-xs font-semibold text-zinc-600">
            {onlineHubsCount} Hubs Live
          </span>
          <span className="text-zinc-300">•</span>
          <span className="text-xs font-semibold text-zinc-600">
            {onlineUsersCount} Patrons Online
          </span>
        </div>

        {/* Right Actions: Auto-Sync, Refresh, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Auto-Sync Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${autoRefresh
              ? 'bg-[#EAF7EE] border-[#BDE8CB] text-[#114227]'
              : 'bg-zinc-50 border-zinc-200 text-zinc-500'
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-[#16A34A] animate-ping' : 'bg-zinc-400'}`} />
            <span className="hidden sm:inline">Auto-Sync: {autoRefresh ? 'ON' : 'OFF'}</span>
            <span className="sm:hidden">{autoRefresh ? 'Sync ON' : 'Sync OFF'}</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchAdminData(false)}
            disabled={loading}
            className="px-3.5 py-1.5 bg-[#114227] hover:bg-[#0D361F] disabled:opacity-50 text-white rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Syncing...' : 'Refresh'}</span>
          </button>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="flex items-center gap-1.5 p-1 pl-1.5 pr-2 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-purple-700 text-white flex items-center justify-center font-bold text-xs border border-zinc-200">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {showUserMenu && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-white border border-zinc-200 rounded-2xl shadow-xl p-1.5 z-50 space-y-1 text-left">
                <div className="px-3 py-2 border-b border-zinc-100">
                  <p className="text-xs font-bold text-zinc-900 truncate">{user?.name || 'Administrator'}</p>
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
                    navigate('/business')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Venues Portal</span>
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
                    <span className="text-[10px] font-black uppercase text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                      Admin
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
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full text-left">
          {/* Header Title Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-800">
                  Live Operations Control
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                  serveq.tech/admin
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
                Global Admin Hub
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium">
                Real-time telemetry, active customer & hub presence, queue monitoring, and venue moderation.
              </p>
            </div>
          </div>

          {/* ── 7 GLOBAL STAT CARDS ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
            {/* 1. Prelaunch Signups */}
            <div
              onClick={() => setActiveTab('prelaunch')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group col-span-2 sm:col-span-1 shadow-xs ${activeTab === 'prelaunch'
                ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-400/40'
                : 'bg-white border-zinc-200/80 hover:border-purple-300'
                }`}
            >
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-[9px] font-black text-purple-700 uppercase">Waitlist</span>
              </div>
              <p className="text-[10px] font-bold uppercase text-zinc-400 group-hover:text-purple-700 transition">Prelaunch</p>
              <p className="text-2xl sm:text-3xl font-black text-purple-700 mt-0.5">
                {stats?.stats?.prelaunchCustomers ?? prelaunchCustomers.length}
              </p>
              <p className="text-[10px] text-purple-700 font-semibold mt-0.5">
                {prelaunchCustomers.filter((c) => c.confirmationEmailSent).length} Confirmed
              </p>
            </div>

            {/* 2. Online Customers */}
            <div
              onClick={() => setActiveTab('customers')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden shadow-xs ${activeTab === 'customers'
                ? 'bg-emerald-50/70 border-[#BDE8CB] ring-2 ring-[#16A34A]/30'
                : 'bg-white border-zinc-200/80 hover:border-emerald-300'
                }`}
            >
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                <span className="text-[9px] font-black text-[#16A34A] uppercase">Live</span>
              </div>
              <p className="text-[10px] font-bold uppercase text-zinc-400">Online Users</p>
              <p className="text-2xl sm:text-3xl font-black text-[#16A34A] mt-0.5">{onlineUsersCount}</p>
              <p className="text-[10px] text-[#114227] font-semibold mt-0.5">Presently Active</p>
            </div>

            {/* 3. Online Hubs */}
            <div
              onClick={() => setActiveTab('hubs')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden shadow-xs ${activeTab === 'hubs'
                ? 'bg-[#EAF7EE] border-[#BDE8CB] ring-2 ring-[#114227]/30'
                : 'bg-white border-zinc-200/80 hover:border-emerald-300'
                }`}
            >
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                <span className="text-[9px] font-black text-teal-700 uppercase">Live</span>
              </div>
              <p className="text-[10px] font-bold uppercase text-zinc-400">Online Hubs</p>
              <p className="text-2xl sm:text-3xl font-black text-teal-700 mt-0.5">{onlineHubsCount}</p>
              <p className="text-[10px] text-teal-700 font-semibold mt-0.5">Active Venues</p>
            </div>

            {/* 4. Total Hubs */}
            <div className="bg-white border border-zinc-200/80 p-4 rounded-2xl shadow-xs">
              <p className="text-[10px] font-bold uppercase text-zinc-400">Total Hubs</p>
              <p className="text-2xl sm:text-3xl font-black text-zinc-950 mt-0.5">{stats?.stats?.businesses || 0}</p>
              <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Registered Venues</p>
            </div>

            {/* 5. Total Users */}
            <div className="bg-white border border-zinc-200/80 p-4 rounded-2xl shadow-xs">
              <p className="text-[10px] font-bold uppercase text-zinc-400">Total Users</p>
              <p className="text-2xl sm:text-3xl font-black text-zinc-950 mt-0.5">{stats?.stats?.users || 0}</p>
              <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Platform Patrons</p>
            </div>

            {/* 6. Total Bookings */}
            <div className="bg-white border border-zinc-200/80 p-4 rounded-2xl shadow-xs">
              <p className="text-[10px] font-bold uppercase text-zinc-400">Total Bookings</p>
              <p className="text-2xl sm:text-3xl font-black text-zinc-950 mt-0.5">{stats?.stats?.bookings || 0}</p>
              <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Appointments</p>
            </div>

            {/* 7. Platform Revenue */}
            <div className="bg-white border border-zinc-200/80 p-4 rounded-2xl shadow-xs">
              <p className="text-[10px] font-bold uppercase text-zinc-400">Revenue</p>
              <p className="text-2xl sm:text-3xl font-black text-[#16A34A] mt-0.5">₹{stats?.stats?.revenue || 0}</p>
              <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Completed Volume</p>
            </div>
          </div>

          {/* Directory Navigation Tabs Pills */}
          <div className="flex border-b border-zinc-200 space-x-2 text-xs font-bold overflow-x-auto pb-2">
            {[
              {
                id: 'hubs',
                label: 'Hubs & Operations Directory',
                pill: `${businesses.length} total • ${onlineHubsCount} online`,
              },
              {
                id: 'customers',
                label: 'Customers & Presence Directory',
                pill: `${usersList.length} total • ${onlineUsersCount} online`,
              },
              {
                id: 'prelaunch',
                label: 'Prelaunch Customers List',
                pill: `${prelaunchCustomers.length} waitlist`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${activeTab === tab.id
                  ? 'bg-[#114227] text-white shadow-xs'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                  }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 text-[10px] rounded-full font-black ${activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-zinc-100 text-zinc-700'
                    }`}
                >
                  {tab.pill}
                </span>
              </button>
            ))}
          </div>

          {/* ── TAB 1: HUBS & OPERATIONS DIRECTORY ── */}
          {activeTab === 'hubs' && (
            <div className="bg-white border border-zinc-200/90 rounded-3xl shadow-xs overflow-hidden space-y-6 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                <div>
                  <h2 className="text-xl font-black text-zinc-950">Registered Hubs & Venues</h2>
                  <p className="text-xs text-zinc-500 font-medium">
                    Monitor online presence, live queues, revenue, operational status, or permanently remove hubs.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search hub by name, city..."
                      value={hubSearch}
                      onChange={(e) => setHubSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-full border border-zinc-200 text-xs focus:outline-none focus:border-[#114227] w-52 bg-white"
                    />
                  </div>

                  {/* Filter Select */}
                  <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-full text-xs font-bold">
                    {['all', 'online', 'approved', 'suspended'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setHubFilter(f)}
                        className={`px-3 py-1 rounded-full capitalize cursor-pointer transition ${hubFilter === f ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                          }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 text-zinc-400 uppercase font-black text-[10px] tracking-wider">
                      <th className="pb-3">Venue Details</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Live Presence</th>
                      <th className="pb-3">Queue Length</th>
                      <th className="pb-3">Approval</th>
                      <th className="pb-3 text-right">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredBusinesses.map((b) => (
                      <tr key={b._id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="py-3.5 font-bold text-zinc-900">
                          <p className="text-sm font-black text-zinc-950">{b.name}</p>
                          <p className="text-[11px] text-zinc-500 font-medium">{b.location || b.address || 'Urban Hub'}</p>
                        </td>
                        <td className="py-3.5 capitalize font-semibold text-zinc-600">{b.category || 'general'}</td>
                        <td className="py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${b.isOpen
                              ? 'bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                          >
                            {b.isOpen ? 'OPEN' : 'CLOSED'}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${b.isOnline
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-zinc-100 text-zinc-500'
                              }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${b.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                            {b.isOnline ? 'Live Socket' : 'Offline'}
                          </span>
                        </td>
                        <td className="py-3.5 font-bold text-zinc-900">
                          {b.currentQueueLength || 0} waiting
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${b.approvalStatus === 'approved' && b.isActive
                              ? 'bg-teal-50 text-teal-800 border border-teal-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                          >
                            {b.approvalStatus || (b.isActive ? 'Active' : 'Suspended')}
                          </span>
                        </td>
                        <td className="py-3.5 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => viewBusinessDetails(b._id)}
                            className="px-3 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs transition cursor-pointer"
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModerate(b._id, b.isActive ? 'suspend' : 'approve')}
                            className={`px-3 py-1 rounded-xl font-bold text-xs transition cursor-pointer ${b.isActive
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                          >
                            {b.isActive ? 'Suspend' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setHubToDelete(b)}
                            className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs transition cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 2: CUSTOMERS & PRESENCE DIRECTORY ── */}
          {activeTab === 'customers' && (
            <div className="bg-white border border-zinc-200/90 rounded-3xl shadow-xs overflow-hidden space-y-6 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                <div>
                  <h2 className="text-xl font-black text-zinc-950">Registered Patrons & Active Presence</h2>
                  <p className="text-xs text-zinc-500 font-medium">
                    Telemetry inspection of customer identities, account balances, and real-time socket connections.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search user by name, email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-full border border-zinc-200 text-xs focus:outline-none focus:border-[#114227] w-52 bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-full text-xs font-bold">
                    {['all', 'online', 'in_queue', 'customer', 'owner'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setUserFilter(f)}
                        className={`px-3 py-1 rounded-full capitalize cursor-pointer transition ${userFilter === f ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                          }`}
                      >
                        {f.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 text-zinc-400 uppercase font-black text-[10px] tracking-wider">
                      <th className="pb-3">Patron Node</th>
                      <th className="pb-3">Assigned Role</th>
                      <th className="pb-3">Socket Presence</th>
                      <th className="pb-3">Active Queue Pass</th>
                      <th className="pb-3">Wallet Balance</th>
                      <th className="pb-3">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#114227] text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {u.name?.[0]?.toUpperCase() || 'P'}
                            </div>
                            <div>
                              <p className="font-bold text-zinc-950">{u.name}</p>
                              <p className="text-[11px] text-zinc-400 font-medium">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${u.role === 'admin'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : u.role === 'owner'
                                ? 'bg-[#EAF7EE] text-[#114227] border border-[#BDE8CB]'
                                : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                              }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${u.isOnline
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-zinc-100 text-zinc-500'
                              }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${u.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                            {u.isOnline ? 'Connected' : 'Offline'}
                          </span>
                        </td>
                        <td className="py-3.5">
                          {u.activeQueue ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                              Position #{u.activeQueue.position}
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3.5 font-bold text-zinc-900">
                          ₹{(u.walletBalance ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${u.isEmailVerified
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                          >
                            {u.isEmailVerified ? 'Email Verified' : 'Unverified'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 3: PRELAUNCH CUSTOMERS LIST ── */}
          {activeTab === 'prelaunch' && (
            <div className="bg-white border border-zinc-200/90 rounded-3xl shadow-xs overflow-hidden space-y-6 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">
                      Early Access Waitlist
                    </span>
                    <span className="text-xs text-zinc-400 font-bold">
                      • {filteredPrelaunchCustomers.length} of {prelaunchCustomers.length} signups
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-zinc-950 mt-1">Prelaunch Customers</h2>
                  <p className="text-xs text-zinc-500 font-medium">
                    Prospects who joined the early access waitlist on the coming soon landing page.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by email, IP..."
                      value={prelaunchSearch}
                      onChange={(e) => setPrelaunchSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-full border border-zinc-200 text-xs focus:outline-none focus:border-[#114227] w-52 bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-full text-xs font-bold">
                    {[
                      { id: 'all', label: 'All', count: prelaunchCustomers.length },
                      { id: 'email_sent', label: 'Sent', count: prelaunchCustomers.filter((c) => c.confirmationEmailSent).length },
                      { id: 'email_pending', label: 'Pending', count: prelaunchCustomers.filter((c) => !c.confirmationEmailSent).length },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setPrelaunchFilter(f.id)}
                        className={`px-3 py-1 rounded-full cursor-pointer transition ${prelaunchFilter === f.id ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                          }`}
                      >
                        {f.label} ({f.count})
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={copyAllPrelaunchEmails}
                    className="px-3.5 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Emails</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportPrelaunchCSV}
                    className="px-4 py-1.5 rounded-full bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Prelaunch Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 text-zinc-400 uppercase font-black text-[10px] tracking-wider">
                      <th className="pb-3">Prelaunch Patron</th>
                      <th className="pb-3">Waitlist Status</th>
                      <th className="pb-3">Confirmation Email</th>
                      <th className="pb-3">Source Channel</th>
                      <th className="pb-3">Client IP</th>
                      <th className="pb-3">Signup Date</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredPrelaunchCustomers.map((c) => (
                      <tr key={c._id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0">
                              {c.email?.[0]?.toUpperCase() || 'P'}
                            </div>
                            <span className="font-bold text-zinc-900">{c.email}</span>
                            <button
                              type="button"
                              onClick={() => copySingleEmail(c.email)}
                              className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                              title="Copy email"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            • {c.status || 'CONFIRMED'}
                          </span>
                        </td>
                        <td className="py-3.5">
                          {c.confirmationEmailSent ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4] flex items-center gap-1 w-max">
                              <Check className="w-3 h-3 text-[#16A34A]" />
                              Email Sent
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 text-zinc-600 capitalize">
                          {c.source ? c.source.replace(/_/g, ' ') : 'Coming Soon'}
                        </td>
                        <td className="py-3.5 text-zinc-400 font-mono text-[11px]">
                          {c.ip || '127.0.0.1'}
                        </td>
                        <td className="py-3.5 text-zinc-500 font-medium">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setCustomerToDelete(c)}
                            className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs transition cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── MODALS ── */}
      {/* 1. Delete Business Confirmation Modal */}
      <AnimatePresence>
        {hubToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-zinc-200 space-y-4 text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-zinc-950">Confirm Permanent Removal</h3>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  Are you sure you want to permanently remove <span className="font-bold text-zinc-900">{hubToDelete.name}</span>? All queue histories, service catalogs, and live slots will be erased.
                </p>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setHubToDelete(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingHub}
                  onClick={confirmDeleteBusiness}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
                >
                  {deletingHub ? 'Deleting...' : 'Delete Hub'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Delete Prelaunch Customer Confirmation Modal */}
      <AnimatePresence>
        {customerToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-zinc-200 space-y-4 text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-zinc-950">Remove Prelaunch Patron</h3>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  Remove <span className="font-bold text-zinc-900">{customerToDelete.email}</span> from the early access waitlist?
                </p>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCustomerToDelete(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingCustomer}
                  onClick={confirmDeletePrelaunchCustomer}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
                >
                  {deletingCustomer ? 'Deleting...' : 'Delete Patron'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Business Details Modal */}
      <AnimatePresence>
        {detailModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-200 space-y-6 text-left my-8"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    Venue Telemetry Inspection
                  </span>
                  <h3 className="text-xl font-black text-zinc-950 mt-1">
                    {selectedBusinessDetail?.business?.name || 'Venue Details'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailModalOpen(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Inspecting Hub Node...</p>
                </div>
              ) : selectedBusinessDetail ? (
                <div className="space-y-5 text-xs">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <p className="text-zinc-500 font-bold uppercase text-[10px]">Total Revenue</p>
                      <p className="text-xl font-black text-emerald-600 mt-0.5">
                        ₹{(selectedBusinessDetail.analytics?.totalRevenue || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <p className="text-zinc-500 font-bold uppercase text-[10px]">Active Queue</p>
                      <p className="text-xl font-black text-zinc-950 mt-0.5">
                        {selectedBusinessDetail.queue?.users?.length || 0} waiting
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <p className="text-zinc-500 font-bold uppercase text-[10px]">Services</p>
                      <p className="text-xl font-black text-zinc-950 mt-0.5">
                        {selectedBusinessDetail.business?.services?.length || 0} items
                      </p>
                    </div>
                  </div>

                  {/* Owner Info */}
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Assigned Owner</p>
                    <p className="text-sm font-bold text-zinc-950">{selectedBusinessDetail.business?.owner?.name}</p>
                    <p className="text-zinc-500">
                      Email: <span className="font-semibold text-zinc-800">{selectedBusinessDetail.business?.owner?.email || 'N/A'}</span>
                    </p>
                  </div>

                  {/* Live Queue Entries */}
                  <div className="space-y-2">
                    <h4 className="font-black text-xs uppercase tracking-wider text-zinc-950">Live Queue Entries</h4>
                    {(selectedBusinessDetail.queue?.users || []).length === 0 ? (
                      <p className="text-zinc-400 py-3 text-center bg-zinc-50 rounded-xl">No active queue entries.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {selectedBusinessDetail.queue.users.map((u, i) => (
                          <div key={i} className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-between text-xs">
                            <span className="font-bold text-zinc-900">{u.userId?.name || 'Customer'}</span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {u.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Modal Actions */}
                  <div className="pt-4 border-t border-zinc-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setHubToDelete(selectedBusinessDetail.business)}
                      className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition cursor-pointer"
                    >
                      Delete Hub
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModerate(selectedBusinessDetail.business?._id, selectedBusinessDetail.business?.isActive ? 'suspend' : 'approve')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${selectedBusinessDetail.business?.isActive
                        ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                    >
                      {selectedBusinessDetail.business?.isActive ? 'Suspend Business' : 'Approve Business'}
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
