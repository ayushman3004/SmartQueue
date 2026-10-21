import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MapPin,
  Search,
  Wallet,
  Bell,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Stethoscope,
  Scissors,
  Ticket,
  Calendar,
  Star,
  Clock,
  HelpCircle,
  LogOut,
  User,
  Users,
  Check,
  CheckCircle,
  Eye,
  Sparkles,
  X,
  Gift,
  ArrowRight,
  RefreshCw,
  Activity,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getQueue, leaveQueue } from '../api/queue.api'
import { getAllBusinesses, getBusiness } from '../api/business.api'
import { getMyBookings } from '../api/booking.api'
import { toast } from 'react-hot-toast'
import { useSeo } from '../utils/useSeo'
import { useDebounce } from '../hooks/useDebounce'

const POPULAR_LOCATIONS = [
  'Kolkata, West Bengal',
  'Bardhaman, West Bengal',
  'Salt Lake, Kolkata',
  'New Town, Kolkata',
  'Park Street, Kolkata',
]

const DEFAULT_SALON_IMAGE = '/hubs/salon.png'
const DEFAULT_CLINIC_IMAGE = '/hubs/clinic.png'

export default function QueuePage() {
  const { businessId: paramBizId } = useParams()
  const { user, logOut } = useAuth()
  const { socket, joinRoom } = useSocket()
  const navigate = useNavigate()

  useSeo({
    title: 'Live Queue Pass & Status | serveQ',
    description: 'Track your live queue position, estimated finish time, and specialist turn in real time.',
    robots: 'noindex, nofollow',
  })

  // Data states
  const [businesses, setBusinesses] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [selectedBizId, setSelectedBizId] = useState(paramBizId || null)
  const [currentQueue, setCurrentQueue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [leavingQueue, setLeavingQueue] = useState(false)

  // Header & Navigation states
  const [selectedCity, setSelectedCity] = useState(POPULAR_LOCATIONS[0])
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Live Queue Modal / Full View
  const [showLiveStreamModal, setShowLiveStreamModal] = useState(false)

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [allRes, myBkRes] = await Promise.all([
        getAllBusinesses({ includeAll: false }),
        getMyBookings().catch(() => ({ data: { data: { bookings: [] } } })),
      ])

      const bizList = allRes.data?.data?.businesses || []
      setBusinesses(bizList)
      setMyBookings(myBkRes.data?.data?.bookings || [])
    } catch (err) {
      console.error('Failed to load queue data:', err)
      toast.error('Unable to fetch live queues')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Join socket rooms for live queue broadcasts
  useEffect(() => {
    if (!socket || businesses.length === 0) return
    businesses.forEach((b) => {
      if (b._id) {
        socket.emit('join:room', { businessId: b._id })
      }
    })

    const handleQueueUpdate = (payload) => {
      if (!payload) return
      const updatedQ = payload.queue || payload
      const targetBizId = (updatedQ.businessId?._id || updatedQ.businessId || payload.businessId)?.toString()

      setBusinesses((prev) =>
        prev.map((b) => {
          if (b._id.toString() === targetBizId || b._id.toString() === updatedQ._id?.toString()) {
            return {
              ...b,
              activeQueue: updatedQ.users || [],
              queueLength: (updatedQ.users || []).length,
            }
          }
          return b
        })
      )

      if (selectedBizId && (selectedBizId.toString() === targetBizId || selectedBizId.toString() === updatedQ._id?.toString())) {
        setCurrentQueue(updatedQ)
      }
    }

    socket.on('queue:update', handleQueueUpdate)
    socket.on('queue:updated', handleQueueUpdate)
    socket.on('queue:joined', handleQueueUpdate)
    socket.on('queue:left', handleQueueUpdate)
    socket.on('service:started', handleQueueUpdate)
    socket.on('service:completed', handleQueueUpdate)

    return () => {
      socket.off('queue:update', handleQueueUpdate)
      socket.off('queue:updated', handleQueueUpdate)
      socket.off('queue:joined', handleQueueUpdate)
      socket.off('queue:left', handleQueueUpdate)
      socket.off('service:started', handleQueueUpdate)
      socket.off('service:completed', handleQueueUpdate)
    }
  }, [socket, businesses, selectedBizId])

  // Identify businesses that ACTUALLY have active queue participants
  const businessesWithActiveQueue = useMemo(() => {
    return businesses.filter((b) => {
      const q = b.activeQueue || []
      return q.length > 0
    })
  }, [businesses])

  // Active queues where current logged-in user is currently in line
  const myActiveQueues = useMemo(() => {
    if (!user?._id) return []
    const myIdStr = user._id.toString()
    const active = []

    businesses.forEach((biz) => {
      const qUsers = biz.activeQueue || []
      const foundIdx = qUsers.findIndex((u) => {
        const uId = (u.userId?._id || u.userId)?.toString()
        return uId === myIdStr
      })

      if (foundIdx !== -1) {
        const myItem = qUsers[foundIdx]
        const position = foundIdx + 1
        active.push({
          business: biz,
          myQueueItem: myItem,
          position,
          peopleAhead: Math.max(0, foundIdx),
          totalInQueue: qUsers.length,
          isServing: myItem.status === 'serving' || foundIdx === 0,
          estimatedStartTime: myItem.estimatedStartTime,
        })
      }
    })

    return active
  }, [businesses, user?._id])

  // Choose the active business to display
  // RULE: If there is no person in any business and no active booking, do not show any business.
  const activeBusiness = useMemo(() => {
    // 1. If user is in an active queue, prioritize that business
    if (myActiveQueues.length > 0) {
      if (selectedBizId) {
        const matchingUserQ = myActiveQueues.find((mq) => mq.business._id === selectedBizId)
        if (matchingUserQ) return matchingUserQ.business
      }
      return myActiveQueues[0].business
    }

    // 2. If user explicitly selected a business and that business HAS an active queue
    if (selectedBizId) {
      const found = businessesWithActiveQueue.find((b) => b._id === selectedBizId)
      if (found) return found
    }

    // 3. Otherwise, fallback to the first business with an ACTIVE queue
    if (businessesWithActiveQueue.length > 0) {
      return businessesWithActiveQueue[0]
    }

    // 4. No active queue anywhere -> null (do NOT show empty business)
    return null
  }, [myActiveQueues, selectedBizId, businessesWithActiveQueue])

  // Active users in line for the chosen active business
  const activeUsers = useMemo(() => {
    if (!activeBusiness) return []
    return activeBusiness.activeQueue || []
  }, [activeBusiness])

  // Check if current user is in this active business queue
  const myQueueItem = useMemo(() => {
    if (!user?._id || !activeBusiness) return null
    const myIdStr = user._id.toString()
    return activeUsers.find((u) => {
      const uId = (u.userId?._id || u.userId)?.toString()
      return uId === myIdStr
    })
  }, [user?._id, activeBusiness, activeUsers])

  const myPosition = myQueueItem ? activeUsers.indexOf(myQueueItem) + 1 : 1
  const isUserServing = myQueueItem?.status === 'serving'
  const isUserWaiting = myQueueItem?.status === 'waiting'
  const peopleAhead = Math.max(0, myPosition - 1)

  // Serving user at this business
  const servingUser = useMemo(() => {
    return activeUsers.find((u) => u.status === 'serving') || activeUsers[0] || null
  }, [activeUsers])

  const waitingUsers = useMemo(() => {
    return activeUsers.filter((u) => u.status === 'waiting')
  }, [activeUsers])

  // Specialist Details
  const assignedSpecialist = useMemo(() => {
    if (myQueueItem?.assignedStaff?.name) {
      return {
        name: myQueueItem.assignedStaff.name,
        role: myQueueItem.assignedStaff.role || (activeBusiness?.category === 'clinic' ? 'Doctor / Specialist' : 'Barber / Stylist'),
      }
    }
    if (servingUser?.assignedStaff?.name) {
      return {
        name: servingUser.assignedStaff.name,
        role: servingUser.assignedStaff.role || (activeBusiness?.category === 'clinic' ? 'Doctor / Specialist' : 'Barber / Stylist'),
      }
    }
    if (activeBusiness?.staff?.length > 0) {
      return {
        name: activeBusiness.staff[0].name,
        role: activeBusiness.staff[0].role || (activeBusiness?.category === 'clinic' ? 'General Physician' : 'On-Duty Stylist'),
      }
    }
    return {
      name: activeBusiness?.category === 'clinic' ? 'Dr. On-Duty' : 'On-Duty Stylist',
      role: activeBusiness?.category === 'clinic' ? 'Physician' : 'Barber / Stylist',
    }
  }, [myQueueItem, servingUser, activeBusiness])

  // Calculated Times for Current Slot & Stepper
  const timeMetrics = useMemo(() => {
    const now = Date.now()
    const targetItem = myQueueItem || servingUser

    let joinedTimeStr = '05:12 PM'
    let servingTimeStr = '05:30 PM'
    let finishEtaStr = '06:00 PM'

    if (targetItem) {
      const joinedDate = targetItem.joinedAt ? new Date(targetItem.joinedAt) : new Date(now - 18 * 60000)
      joinedTimeStr = joinedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })

      const servingDate = targetItem.estimatedStartTime
        ? new Date(targetItem.estimatedStartTime)
        : new Date(now)
      servingTimeStr = servingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })

      const durationMins = Number(targetItem.serviceTime) || activeBusiness?.averageServiceTime || 30
      const finishDate = new Date(servingDate.getTime() + durationMins * 60000)
      finishEtaStr = finishDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    }

    return { joinedTimeStr, servingTimeStr, finishEtaStr }
  }, [myQueueItem, servingUser, activeBusiness])

  // Service Name
  const currentServiceName = useMemo(() => {
    if (myQueueItem?.serviceType) return myQueueItem.serviceType
    if (myQueueItem?.services?.length > 0) return myQueueItem.services[0].name
    if (servingUser?.serviceType) return servingUser.serviceType
    if (activeBusiness?.services?.length > 0) return activeBusiness.services[0].name
    return activeBusiness?.category === 'clinic' ? 'Consultation & Checkup' : 'Haircut & Styling'
  }, [myQueueItem, servingUser, activeBusiness])

  const serviceDuration = myQueueItem?.serviceTime || activeBusiness?.averageServiceTime || 30

  // Leave Queue Handler
  const handleLeaveQueue = async () => {
    if (!activeBusiness) return
    if (!window.confirm(`Leave queue at ${activeBusiness.name}? You will step out of line.`)) return

    try {
      setLeavingQueue(true)
      await leaveQueue(activeBusiness._id)
      toast.success(`You stepped out of the queue at ${activeBusiness.name}`)
      await fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not leave queue')
    } finally {
      setLeavingQueue(false)
    }
  }

  const categoryLabel = activeBusiness?.category === 'clinic' ? 'Clinic Hub' : 'Salon Hub'
  const isSalon = activeBusiness?.category === 'salon' || activeBusiness?.category === 'barbershop'

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-zinc-900 flex flex-col font-sans">
      {/* ── TOP HEADER BAR (MATCHING SCREENSHOT) ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3">
          <Link to="/customers" className="flex items-center gap-2 group text-decoration-none">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 font-sans flex items-center">
              serve<span className="text-[#16A34A]">q</span>
            </span>
          </Link>
        </div>

        {/* Center: Location Pill & Search Bar */}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-2xl mx-4">
          <div className="relative">
            <button
              onClick={() => setShowLocationPicker((prev) => !prev)}
              className="px-3.5 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/60 text-xs font-semibold text-zinc-800 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              <span>{selectedCity}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {showLocationPicker && (
              <div className="absolute top-full left-0 mt-1.5 w-60 bg-white border border-zinc-200 rounded-2xl shadow-xl p-2 z-50 space-y-1">
                <p className="text-[10px] font-bold uppercase text-zinc-400 px-2 py-1">Select Location</p>
                {POPULAR_LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => {
                      setSelectedCity(loc)
                      setShowLocationPicker(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                      selectedCity === loc ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    <MapPin className="w-3 h-3 text-zinc-400" />
                    <span>{loc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search clinic or salon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-full bg-zinc-100/90 border border-zinc-200/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
            />
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2 text-xs text-zinc-400 hover:text-zinc-600 flex items-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Wallet Balance, Notifications, Profile Avatar */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/wallet')}
            className="px-3.5 py-1.5 rounded-full bg-[#EAF7EE] border border-[#BDE8CB] hover:bg-[#DDF3E3] text-xs font-bold text-[#114227] flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5 text-[#114227]" />
            <span>₹{(user?.walletBalance ?? 0).toLocaleString()}</span>
          </button>

          <button
            onClick={() => toast('No new notifications', { icon: 'info' })}
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors relative cursor-pointer"
          >
            <Bell className="w-4 h-4 text-zinc-600" />
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-2 border-2 border-white" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-700 text-white flex items-center justify-center font-bold text-xs border border-zinc-200">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <span className="text-xs font-bold text-zinc-900 hidden sm:inline">
                {user?.name?.split(' ')[0] || 'Customer'}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {showUserMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-2xl shadow-xl p-1.5 z-50 space-y-1">
                <div className="px-3 py-2 border-b border-zinc-100">
                  <p className="text-xs font-bold text-zinc-900 line-clamp-1">{user?.name || 'Customer'}</p>
                  <p className="text-[10px] text-zinc-400 line-clamp-1">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    navigate('/profile')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>View Profile</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/wallet')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Wallet & Top-up</span>
                </button>
                <button
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

      {/* ── BODY: SIDEBAR + MAIN CANVAS (MATCHING SCREENSHOT) ── */}
      <div className="flex-1 flex w-full">
        {/* LEFT SIDEBAR */}
        <aside className="w-56 shrink-0 hidden lg:flex flex-col justify-between py-5 px-4 border-r border-zinc-200/70 min-h-[calc(100vh-61px)] bg-white/40">
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, route: '/customers' },
              { id: 'clinics', label: 'Clinics', icon: Stethoscope, route: '/customers?category=clinic' },
              { id: 'salons', label: 'Salons', icon: Scissors, route: '/customers?category=salon' },
              { id: 'my-queues', label: 'My Queues', icon: Ticket, count: myActiveQueues.length, route: '/queue' },
              {
                id: 'appointments',
                label: 'Appointments',
                icon: Calendar,
                count: myBookings.filter(
                  (b) => b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'refunded'
                ).length,
                route: '/booking',
              },
              { id: 'reviews', label: 'Reviews', icon: Star, route: '/history' },
              { id: 'history', label: 'History', icon: Clock, route: '/history' },
            ].map((item) => {
              const isActive = item.id === 'my-queues'
              const IconComponent = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.route)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#EAF5EC] text-[#114227] shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className={`w-4 h-4 ${isActive ? 'text-[#114227]' : 'text-zinc-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isActive ? 'bg-[#114227] text-white' : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Bottom Sidebar: Refer & Earn and Help & Support */}
          <div className="pt-4 border-t border-zinc-100 space-y-1">
            <button
              onClick={() => toast.success('Referral code copied to clipboard!')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
            >
              <Gift className="w-4 h-4 text-purple-600" />
              <span>Refer & Earn</span>
            </button>
            <button
              onClick={() => toast('Support hotline: help@serveq.tech', { icon: 'info' })}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-zinc-500" />
              <span>Help & Support</span>
            </button>
          </div>
        </aside>

        {/* MAIN CANVAS */}
        <main className="flex-1 px-4 py-5 sm:px-8 sm:py-7 space-y-6 min-w-0 max-w-6xl">
          {/* ── TOP GREETING BANNER (MATCHING SCREENSHOT) ── */}
          <div className="rounded-3xl bg-gradient-to-r from-[#F4F9F5] via-[#EBF5ED] to-[#E2F0E5] border border-[#DCEDE0] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-2xs">
            <div className="space-y-1.5 z-10">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-zinc-950 tracking-tight font-sans">
                Welcome back,{' '}
                <span className="text-[#16A34A]">{user?.name?.split(' ')[0] || 'Patron'}!</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-600 font-medium">
                Here's your current queue and updates.
              </p>
            </div>

            {/* Decorative Banner Illustration with Boy character */}
            <div className="hidden md:flex items-end justify-center shrink-0 pr-4 z-10 self-end -mb-6 sm:-mb-8">
              <div className="relative w-36 sm:w-44 h-32 sm:h-36 flex items-end justify-center">
                <img
                  src="/queue-hero-boy.png"
                  alt="Patron checking queue on phone"
                  className="max-h-full max-w-full object-contain drop-shadow-md rounded-2xl"
                  onError={(e) => {
                    e.currentTarget.src = '/hero-banner.png'
                  }}
                />
              </div>
            </div>

            {/* Soft decorative ambient circles */}
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-200/30 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute right-40 -top-10 w-36 h-36 bg-teal-100/40 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Business Switcher if multiple venues have active queues */}
          {businessesWithActiveQueue.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-zinc-400 shrink-0 uppercase tracking-wider">
                Active Queues:
              </span>
              {businessesWithActiveQueue.map((b) => {
                const isSelected = activeBusiness?._id === b._id
                return (
                  <button
                    key={b._id}
                    onClick={() => setSelectedBizId(b._id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#114227] text-white shadow-xs'
                        : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {b.name} ({b.activeQueue?.length || 0} in line)
                  </button>
                )
              })}
            </div>
          )}

          {/* ── CORE ACTIVE QUEUE VIEW (OR STRICT EMPTY STATE) ── */}
          {loading ? (
            <div className="p-16 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-3xl bg-white space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-semibold text-zinc-600">Connecting to live queue stream...</p>
            </div>
          ) : !activeBusiness || activeUsers.length === 0 ? (
            /* ── EMPTY STATE: IF NO PERSON IN ANY BUSINESS / NO ACTIVE QUEUE, DO NOT SHOW EMPTY BUSINESS ── */
            <div className="bg-white rounded-3xl border border-dashed border-zinc-300/80 p-10 sm:p-14 text-center space-y-4 shadow-2xs">
              <div className="w-16 h-16 rounded-3xl bg-[#EAF7EE] text-[#16A34A] border border-[#BDE8CB] flex items-center justify-center mx-auto shadow-2xs">
                <Ticket className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-lg sm:text-xl font-black text-zinc-950">No Active Queues Right Now</h3>
                <p className="text-xs sm:text-sm text-zinc-500">
                  You are not currently in any live queue, and there are currently no waiting queues active across any partner clinics or salons.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  onClick={() => navigate('/customers?category=clinic')}
                  className="px-5 py-2.5 rounded-xl bg-[#114227] hover:bg-[#0D361F] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Browse Clinics
                </button>
                <button
                  onClick={() => navigate('/customers?category=salon')}
                  className="px-5 py-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                >
                  Browse Salons
                </button>
                <button
                  onClick={() => navigate('/booking')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  Book Appointment
                </button>
              </div>
            </div>
          ) : (
            /* ── ACTIVE QUEUE UI (EXACT SCREENSHOT LAYOUT) ── */
            <div className="space-y-6">
              {/* 2-Column Main Queue Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
                {/* ── LEFT CARD: YOUR TURN / QUEUE STATUS (4 cols on lg) ── */}
                <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden">
                  <div>
                    {/* Top Status Badge & Graphic Header */}
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
                        <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                        <span>{isUserServing || activeUsers[0]?.status === 'serving' ? 'READY FOR YOU' : `IN LINE (TOKEN #${myPosition})`}</span>
                      </span>

                      {/* Cute Phone / Sparkles badge */}
                      <div className="w-11 h-11 rounded-2xl bg-[#EAF7EE] border border-[#BDE8CB] flex items-center justify-center relative text-[#16A34A] shadow-2xs">
                        <Ticket className="w-5 h-5" />
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 absolute -top-1 -right-1" />
                      </div>
                    </div>

                    {/* Headline */}
                    <div className="mt-5 space-y-1">
                      <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight font-sans">
                        {isUserServing || activeUsers[0]?.status === 'serving' ? 'Your Turn!' : `Token #${myPosition}`}
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-500 font-medium">
                        {isUserServing || activeUsers[0]?.status === 'serving'
                          ? 'Please proceed to the service desk.'
                          : `${peopleAhead} people ahead of you • Please stay nearby`}
                      </p>
                    </div>

                    {/* Assigned Specialist Box */}
                    <div className="bg-[#F4FAF6] border border-[#D5EFE0] rounded-2xl p-4 flex items-center gap-3.5 mt-6">
                      <div className="w-11 h-11 rounded-full bg-[#D8F3E2] border border-[#BCE6CB] text-[#16A34A] flex items-center justify-center shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                          Assigned Specialist
                        </p>
                        <p className="font-bold text-zinc-950 text-sm sm:text-base truncate">
                          {assignedSpecialist.name}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {assignedSpecialist.role}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Red Leave Queue Button */}
                  <div className="pt-6">
                    <button
                      type="button"
                      disabled={leavingQueue}
                      onClick={handleLeaveQueue}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#FF4D5E] hover:bg-[#E83C4D] disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-98 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{leavingQueue ? 'Stepping out...' : 'Leave Queue & Step Out'}</span>
                    </button>
                  </div>
                </div>

                {/* ── RIGHT CARD: LIVE QUEUE STREAM & TRACKING (7 cols on lg) ── */}
                <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-5 flex flex-col justify-between">
                  <div>
                    {/* Top Row: Business Thumbnail, Name, Waiting Count & Open Pill */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left: Thumbnail & Name */}
                      <div className="flex items-center gap-3.5">
                        <img
                          src={
                            activeBusiness.images?.[0] ||
                            (isSalon ? DEFAULT_SALON_IMAGE : DEFAULT_CLINIC_IMAGE)
                          }
                          alt={activeBusiness.name}
                          className="w-14 h-14 rounded-2xl object-cover border border-zinc-200 shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = isSalon ? DEFAULT_SALON_IMAGE : DEFAULT_CLINIC_IMAGE
                          }}
                        />
                        <div>
                          <h3 className="font-black text-xl text-zinc-950 tracking-tight">
                            {activeBusiness.name}
                          </h3>
                          <p className="text-xs text-zinc-500 font-medium">
                            {categoryLabel} • Live Synchronous Stream
                          </p>
                        </div>
                      </div>

                      {/* Right: Waiting Badge & Open Status */}
                      <div className="flex items-center gap-2.5 self-start sm:self-auto">
                        <div className="border border-zinc-200 rounded-2xl px-3.5 py-1.5 text-center min-w-[70px]">
                          <p className="font-black text-zinc-950 text-base leading-tight">
                            {waitingUsers.length}
                          </p>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                            WAITING
                          </p>
                        </div>
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
                          <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                          <span>{activeBusiness.isOpen ? 'OPEN' : 'CLOSED'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Current Slot Banner */}
                    <div className="mt-5 rounded-2xl border border-[#BDE8CB] bg-[#F4FAF6] p-3.5 sm:p-4 flex items-center justify-between gap-3">
                      {/* Left Tag + Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-[#00A854] text-white font-black text-xs px-2.5 py-1 rounded-lg shrink-0">
                          NOW
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-zinc-900 text-xs sm:text-sm">
                              Your Current Slot
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4] inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                              <span>SERVING</span>
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 truncate mt-0.5">
                            {currentServiceName} • {serviceDuration} min block •{' '}
                            <span className="font-semibold text-zinc-700">{assignedSpecialist.name}</span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Finish ETA */}
                      <div className="text-right shrink-0 pl-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                          FINISH ETA
                        </p>
                        <p className="font-black text-sm sm:text-base text-[#114227]">
                          {timeMetrics.finishEtaStr}
                        </p>
                      </div>
                    </div>

                    {/* Stepper / Progress Bar (4 Milestones) */}
                    <div className="mt-7 px-2">
                      <div className="relative flex items-center justify-between">
                        {/* Connecting Line background */}
                        <div className="absolute top-3 left-4 right-4 h-0.5 bg-zinc-200 -z-0" />
                        <div className="absolute top-3 left-4 w-1/3 h-0.5 bg-[#16A34A] -z-0" />

                        {/* Step 1: Joined Queue */}
                        <div className="flex flex-col items-center text-center relative z-10 space-y-1">
                          <div className="w-6 h-6 rounded-full bg-[#16A34A] text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <p className="text-[11px] font-bold text-zinc-900">Joined Queue</p>
                          <p className="text-[10px] text-zinc-400 font-medium">
                            {timeMetrics.joinedTimeStr}
                          </p>
                        </div>

                        {/* Step 2: Now Serving */}
                        <div className="flex flex-col items-center text-center relative z-10 space-y-1">
                          <div className="w-6 h-6 rounded-full border-2 border-[#16A34A] bg-white flex items-center justify-center p-0.5 shadow-xs">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                          </div>
                          <p className="text-[11px] font-bold text-[#16A34A]">Now Serving</p>
                          <p className="text-[10px] text-zinc-400 font-medium">
                            {timeMetrics.servingTimeStr}
                          </p>
                        </div>

                        {/* Step 3: Almost Done */}
                        <div className="flex flex-col items-center text-center relative z-10 space-y-1">
                          <div className="w-6 h-6 rounded-full border-2 border-zinc-300 bg-white shadow-2xs" />
                          <p className="text-[11px] font-medium text-zinc-500">Almost Done</p>
                          <p className="text-[10px] text-zinc-400 font-medium">
                            ~{timeMetrics.finishEtaStr}
                          </p>
                        </div>

                        {/* Step 4: Completed */}
                        <div className="flex flex-col items-center text-center relative z-10 space-y-1">
                          <div className="w-6 h-6 rounded-full border-2 border-zinc-200 bg-white shadow-2xs" />
                          <p className="text-[11px] font-medium text-zinc-400">Completed</p>
                          <p className="text-[10px] text-zinc-300 font-medium">--</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Buttons: View Live Queue & Reschedule / Booking */}
                  <div className="flex items-center gap-3 pt-4 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => setShowLiveStreamModal(true)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-zinc-600" />
                      <span>View Live Queue</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/booking/${activeBusiness._id}`)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Calendar className="w-4 h-4 text-zinc-600" />
                      <span>Reschedule / Booking</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── BOTTOM CALLOUT CARD: BOOK APPOINTMENT INSTEAD (MATCHING SCREENSHOT) ── */}
              <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#EAF7EE] border border-[#BDE8CB] text-[#16A34A] flex items-center justify-center shrink-0">
                    <Calendar className="w-6 h-6 text-[#16A34A]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-950 text-sm sm:text-base">
                      Need to book a different time?
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      You can also book an appointment instead of joining the live queue.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/booking/${activeBusiness._id}`)}
                  className="px-5 py-2.5 rounded-full border border-[#16A34A] text-[#114227] hover:bg-emerald-50 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <span>Book Appointment</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── LIVE QUEUE STREAM MODAL (COLUMNS BY STAFF) ── */}
      <AnimatePresence>
        {showLiveStreamModal && activeBusiness && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="text-lg font-black text-zinc-950">
                    {activeBusiness.name} — Live Queue Counter Stream
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Real-time tickets and assigned counters per doctor / specialist.
                  </p>
                </div>
                <button
                  onClick={() => setShowLiveStreamModal(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Counter Columns */}
              <div className="space-y-4">
                {activeUsers.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-6 text-center">No active tickets right now.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {activeUsers.map((u, idx) => {
                      const isMe = (u.userId?._id || u.userId)?.toString() === user?._id?.toString()
                      const isServ = u.status === 'serving'
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-2xl border transition-all ${
                            isMe
                              ? 'bg-[#EAF7EE] border-[#BDE8CB] ring-2 ring-[#16A34A]/20'
                              : 'bg-zinc-50 border-zinc-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-sm text-zinc-900">
                              Token #{idx + 1}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isServ
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-zinc-200 text-zinc-700'
                              }`}
                            >
                              {isServ ? 'SERVING NOW' : 'WAITING'}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-zinc-700 mt-1">
                            {u.serviceType || 'General Service'}
                          </p>
                          <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3 text-zinc-400" />
                            <span>{u.assignedStaff?.name || 'On-Duty Specialist'}</span>
                          </p>
                          {isMe && (
                            <p className="text-[11px] font-bold text-[#16A34A] mt-2">
                              This is your ticket!
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowLiveStreamModal(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#114227] text-white cursor-pointer"
                >
                  Close Live View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}