import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MapPin,
  Search,
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
  Menu,
  Gift,
  ArrowRight,
  RefreshCw,
  Activity,
  Plus,
  Play,
  Info,
} from 'lucide-react'
import CustomerSidebar from '../components/CustomerSidebar'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getQueue, joinQueue, leaveQueue } from '../api/queue.api'
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
  const [joiningQueue, setJoiningQueue] = useState(false)
  const [selectedService, setSelectedService] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState('any')

  // Sync selectedBizId when URL parameter changes
  useEffect(() => {
    if (paramBizId) {
      setSelectedBizId(paramBizId)
    }
  }, [paramBizId])

  // Header & Navigation states
  const [selectedCity, setSelectedCity] = useState(POPULAR_LOCATIONS[0])
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
    if (!user) return []
    const myIdStr = (user._id || user.id)?.toString()
    if (!myIdStr) return []
    const active = []

    businesses.forEach((biz) => {
      const qUsers = biz.activeQueue || []
      const foundIdx = qUsers.findIndex((u) => {
        const uId = (u.userId?._id || u.userId || u.userId?.id)?.toString()
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
  }, [businesses, user])

  // Choose the active business to display
  const activeBusiness = useMemo(() => {
    // 1. If user explicitly selected a business from URL/state, use that business
    if (selectedBizId) {
      const found = businesses.find((b) => b._id?.toString() === selectedBizId.toString())
      if (found) return found
    }

    // 2. If user is in an active queue, prioritize that business
    if (myActiveQueues.length > 0) {
      return myActiveQueues[0].business
    }

    // 3. Otherwise, fallback to the first business with an ACTIVE queue
    if (businessesWithActiveQueue.length > 0) {
      return businessesWithActiveQueue[0]
    }

    // 4. Default to first business available
    return businesses[0] || null
  }, [businesses, selectedBizId, myActiveQueues, businessesWithActiveQueue])

  // Reset selected service and staff when active business changes
  useEffect(() => {
    if (activeBusiness?.services?.length > 0) {
      setSelectedService(activeBusiness.services[0])
    } else {
      setSelectedService(null)
    }
    setSelectedStaff('any')
  }, [activeBusiness?._id])

  // Active users in line for the chosen active business
  const activeUsers = useMemo(() => {
    if (!activeBusiness) return []
    return activeBusiness.activeQueue || []
  }, [activeBusiness])

  // Check if current user is in this active business queue
  const myQueueItem = useMemo(() => {
    if (!user || !activeBusiness) return null
    const myIdStr = (user._id || user.id)?.toString()
    if (!myIdStr) return null
    return activeUsers.find((u) => {
      const uId = (u.userId?._id || u.userId || u.userId?.id)?.toString()
      return uId === myIdStr
    }) || null
  }, [user, activeBusiness, activeUsers])

  const hasJoinedQueue = Boolean(myQueueItem)

  const myPosition = useMemo(() => {
    if (!hasJoinedQueue || !activeBusiness) return 0
    const myIdStr = (user._id || user.id)?.toString()
    const idx = activeUsers.findIndex((u) => {
      const uId = (u.userId?._id || u.userId || u.userId?.id)?.toString()
      return uId === myIdStr
    })
    return idx !== -1 ? idx + 1 : 1
  }, [hasJoinedQueue, activeBusiness, activeUsers, user])

  const isUserServing = hasJoinedQueue && (myQueueItem?.status === 'serving' || myPosition === 1)
  const isUserWaiting = hasJoinedQueue && !isUserServing
  const peopleAhead = Math.max(0, myPosition - 1)

  // Serving user at this business
  const servingUser = useMemo(() => {
    return activeUsers.find((u) => u.status === 'serving') || (activeUsers.length > 0 ? activeUsers[0] : null)
  }, [activeUsers])

  const waitingUsers = useMemo(() => {
    return activeUsers.filter((u) => u.status === 'waiting' && u !== servingUser)
  }, [activeUsers, servingUser])

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

    let joinedTimeStr = '09:17 am'
    let servingTimeStr = '09:17 am'
    let finishEtaStr = '09:47 am'

    if (targetItem) {
      const joinedDate = targetItem.joinedAt ? new Date(targetItem.joinedAt) : new Date(now - 15 * 60000)
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

  // Join Queue Handler
  const handleJoinQueue = async (biz = activeBusiness) => {
    if (!biz) return
    if (biz.queueSettings?.enableLiveQueue === false) {
      toast.error('Live queue is currently disabled for this business.')
      return
    }
    if (!biz.isOpen) {
      toast.error('This business is currently closed for check-ins.')
      return
    }

    const services = biz.services || []
    const curService =
      selectedService ||
      (services.length > 0
        ? services[0]
        : {
            name: biz.category === 'clinic' ? 'General Consultation' : 'General Service',
            duration: biz.averageServiceTime || 15,
            price: biz.basePrice || 0,
          })

    const preferredStaffName = selectedStaff === 'any' ? null : selectedStaff
    const paymentMethod = 'counter'

    setJoiningQueue(true)
    try {
      const res = await joinQueue(biz._id, {
        services: [curService],
        serviceType: curService.name,
        preferredStaff: preferredStaffName,
        paymentMethod,
      })
      const updatedQ = res.data?.data?.queue
      if (updatedQ) {
        setBusinesses((prev) =>
          prev.map((b) =>
            b._id === biz._id
              ? { ...b, activeQueue: updatedQ.users || [], queueLength: (updatedQ.users || []).length }
              : b
          )
        )
      }
      toast.success(`You joined the live queue at ${biz.name}!`)
      await fetchData()
    } catch (err) {
      if (err.response?.status === 400 || err.response?.data?.message?.includes('already')) {
        toast('You are already registered in this queue.')
        await fetchData()
      } else {
        toast.error(err.response?.data?.message || 'Failed to join queue')
      }
    } finally {
      setJoiningQueue(false)
    }
  }

  // Leave Queue Handler
  const handleLeaveQueue = async () => {
    if (!activeBusiness) return
    if (!window.confirm(`Leave queue at ${activeBusiness.name}? You will step out of line.`)) return

    try {
      setLeavingQueue(true)
      const res = await leaveQueue(activeBusiness._id)
      const updatedQueue = res.data?.data?.queue

      // Immediately filter user out in local state so UI updates instantly
      const myIdStr = (user?._id || user?.id)?.toString()
      setBusinesses((prev) =>
        prev.map((b) => {
          if (b._id === activeBusiness._id) {
            const filtered = updatedQueue?.users || (b.activeQueue || []).filter(
              (u) => (u.userId?._id || u.userId || u.userId?.id)?.toString() !== myIdStr
            )
            return {
              ...b,
              activeQueue: filtered,
              queueLength: filtered.length,
            }
          }
          return b
        })
      )

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
    <div className="min-h-screen app-background-glow text-zinc-900 flex flex-col font-sans relative overflow-x-hidden">
      {/* ── TOP HEADER BAR (MATCHING SCREENSHOT) ── */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Hamburger + Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/customers" className="flex items-center group text-decoration-none">
            <img src="/serveq-logo.png" alt="serveQ" className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105" />
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

        {/* Right: Notifications, Profile Avatar */}
        <div className="flex items-center gap-2.5">
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
        {/* CUSTOMER SIDEBAR (DESKTOP + ANIMATED MOBILE DRAWER) */}
        <CustomerSidebar
          activeNavTab="my-queues"
          clinicsCount={businesses.filter((b) => b.category === 'clinic').length}
          salonsCount={businesses.filter((b) => b.category === 'salon' || b.category === 'barbershop').length}
          myActiveQueuesCount={businesses.filter((b) => (b.activeQueue || []).some((u) => (u.userId?._id || u.userId)?.toString() === user?._id?.toString())).length}
          myBookingsCount={myBookings.filter(
            (b) => b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'refunded'
          ).length}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

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

            {/* Decorative Banner Illustration with Boy character (Background completely removed) */}
            <div className="hidden md:flex items-end justify-end shrink-0 z-10 self-end -mb-6 sm:-mb-8 pr-2 lg:pr-6 pointer-events-none select-none">
              <div className="relative w-40 sm:w-48 lg:w-56 h-36 sm:h-40 lg:h-44 flex items-end justify-end">
                <img
                  src="/queue-hero-boy-transparent.png"
                  alt="Patron checking queue on phone"
                  className="max-h-full max-w-full object-contain drop-shadow-xl"
                  onError={(e) => {
                    e.currentTarget.src = '/queue-hero-boy.png'
                  }}
                />
              </div>
            </div>

            {/* Soft decorative ambient circles */}
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-200/30 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute right-40 -top-10 w-36 h-36 bg-teal-100/40 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* If user is in a queue at another business, show quick switcher banner */}
          {myActiveQueues.length > 0 && myActiveQueues.some((q) => q.business._id !== activeBusiness?._id) && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Ticket className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-emerald-950">
                    You have an active ticket at {myActiveQueues[0].business.name} (Token #{myActiveQueues[0].position})
                  </p>
                  <p className="text-emerald-700">
                    {myActiveQueues[0].isServing ? 'Your turn is ready!' : `${myActiveQueues[0].peopleAhead} people ahead of you.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBizId(myActiveQueues[0].business._id)
                  navigate(`/queue/${myActiveQueues[0].business._id}`)
                }}
                className="px-4 py-2 rounded-xl bg-[#114227] hover:bg-[#0D361F] text-white font-bold text-xs transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
              >
                View My Pass
              </button>
            </div>
          )}

          {/* Business Switcher */}
          {businesses.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-zinc-400 shrink-0 uppercase tracking-wider">
                Venues:
              </span>
              {businesses.map((b) => {
                const isSelected = activeBusiness?._id === b._id
                const isMyQueue = myActiveQueues.some((mq) => mq.business._id === b._id)
                const count = b.activeQueue?.length || 0
                return (
                  <button
                    key={b._id}
                    onClick={() => {
                      setSelectedBizId(b._id)
                      navigate(`/queue/${b._id}`)
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#114227] text-white shadow-xs'
                        : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <span>{b.name}</span>
                    {isMyQueue && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        isSelected ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        My Ticket
                      </span>
                    )}
                    <span className={`text-[10px] ${isSelected ? 'text-emerald-200' : 'text-zinc-400'}`}>
                      ({count})
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* ── CORE VIEW (LOADING / EMPTY / JOINED PASS / ACTUAL QUEUE) ── */}
          {loading ? (
            <div className="p-16 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-3xl bg-white space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-semibold text-zinc-600">Connecting to live queue stream...</p>
            </div>
          ) : !activeBusiness ? (
            /* No business available */
            <div className="bg-white rounded-3xl border border-dashed border-zinc-300/80 p-10 sm:p-14 text-center space-y-4 shadow-2xs">
              <div className="w-16 h-16 rounded-3xl bg-[#EAF7EE] text-[#16A34A] border border-[#BDE8CB] flex items-center justify-center mx-auto shadow-2xs">
                <Ticket className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-lg sm:text-xl font-black text-zinc-950">No Businesses Found</h3>
                <p className="text-xs sm:text-sm text-zinc-500">
                  There are currently no partner clinics or salons available.
                </p>
              </div>
            </div>
          ) : hasJoinedQueue ? (
            /* ── VIEW A: USER HAS JOINED QUEUE -> SHOW THE PERSONAL PASS & STATUS ── */
            <div className="space-y-6">
              {/* 2-Column Main Queue Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
                {/* ── LEFT CARD: YOUR TURN / TOKEN STATUS ── */}
                <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden">
                  <div>
                    {/* Top Status Badge & Graphic Header */}
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${
                        isUserServing
                          ? 'bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${isUserServing ? 'bg-[#16A34A] animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
                        <span>{isUserServing ? 'READY FOR YOU' : `IN LINE (TOKEN #${myPosition})`}</span>
                      </span>

                      {/* Ticket badge */}
                      <div className="w-11 h-11 rounded-2xl bg-[#EAF7EE] border border-[#BDE8CB] flex items-center justify-center relative text-[#16A34A] shadow-2xs">
                        <Ticket className="w-5 h-5" />
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 absolute -top-1 -right-1" />
                      </div>
                    </div>

                    {/* Headline */}
                    <div className="mt-5 space-y-1">
                      <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight font-sans">
                        {isUserServing ? 'Your Turn!' : `Token #${myPosition}`}
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-500 font-medium">
                        {isUserServing
                          ? 'Please proceed to the service desk.'
                          : `${peopleAhead} ${peopleAhead === 1 ? 'person' : 'people'} ahead of you • Please stay nearby`}
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

                {/* ── RIGHT CARD: LIVE QUEUE STREAM & TRACKING ── */}
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
                          {isUserServing ? 'NOW' : 'UPCOMING'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-zinc-900 text-xs sm:text-sm">
                              Your Current Slot
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                              isUserServing
                                ? 'bg-[#EAF7EE] text-[#16A34A] border-[#CDEBD4]'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isUserServing ? 'bg-[#16A34A]' : 'bg-amber-500'}`} />
                              <span>{isUserServing ? 'SERVING' : 'WAITING IN LINE'}</span>
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 truncate mt-0.5">
                            {currentServiceName} • {serviceDuration} min block •{' '}
                            <span className="font-semibold text-zinc-700">{assignedSpecialist.name}</span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Finish ETA or Est Start */}
                      <div className="text-right shrink-0 pl-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                          {isUserServing ? 'FINISH ETA' : 'EST. START'}
                        </p>
                        <p className="font-black text-sm sm:text-base text-[#114227]">
                          {isUserServing ? timeMetrics.finishEtaStr : timeMetrics.servingTimeStr}
                        </p>
                      </div>
                    </div>

                    {/* Stepper / Progress Bar (4 Milestones) */}
                    <div className="mt-7 px-2">
                      <div className="relative flex items-center justify-between">
                        {/* Connecting Line background */}
                        <div className="absolute top-3 left-4 right-4 h-0.5 bg-zinc-200 -z-0" />
                        <div className={`absolute top-3 left-4 h-0.5 bg-[#16A34A] -z-0 transition-all ${isUserServing ? 'w-1/3' : 'w-0'}`} />

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
                          {isUserServing ? (
                            <div className="w-6 h-6 rounded-full border-2 border-[#16A34A] bg-white flex items-center justify-center p-0.5 shadow-xs">
                              <div className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-amber-400 bg-white flex items-center justify-center p-0.5 shadow-xs">
                              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                            </div>
                          )}
                          <p className={`text-[11px] font-bold ${isUserServing ? 'text-[#16A34A]' : 'text-amber-700'}`}>
                            {isUserServing ? 'Now Serving' : 'In Line'}
                          </p>
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

                    {/* Pay at Counter Status Card */}
                    <div className="mt-5 p-3.5 sm:p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                          myQueueItem?.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          ₹
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Payment (Pay at Counter)</p>
                          <p className="text-sm font-black text-zinc-900">
                            Amount: ₹{myQueueItem?.paidAmount ?? (selectedService?.price || activeBusiness.basePrice || 0)}
                          </p>
                        </div>
                      </div>
                      <div>
                        {myQueueItem?.paymentStatus === 'paid' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Paid at Counter
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            Pending at Counter
                          </span>
                        )}
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

              {/* ── BOTTOM CALLOUT CARD: BOOK APPOINTMENT INSTEAD ── */}
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
          ) : (
            /* ── VIEW B: NOT IN QUEUE -> SHOW THE ACTUAL QUEUE & JOIN CARD ── */
            <div className="space-y-6">
              {/* Business Overview & Live Key Stats Strip */}
              <div className="rounded-3xl bg-white border border-zinc-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <img
                    src={
                      activeBusiness.images?.[0] ||
                      (isSalon ? DEFAULT_SALON_IMAGE : DEFAULT_CLINIC_IMAGE)
                    }
                    alt={activeBusiness.name}
                    className="w-16 h-16 rounded-2xl object-cover border border-zinc-200 shrink-0"
                    onError={(e) => {
                      e.currentTarget.src = isSalon ? DEFAULT_SALON_IMAGE : DEFAULT_CLINIC_IMAGE
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-black text-xl text-zinc-950 tracking-tight">
                        {activeBusiness.name}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
                        {activeBusiness.isOpen ? 'OPEN NOW' : 'CLOSED'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium mt-0.5">
                      {categoryLabel} • {activeBusiness.address || selectedCity}
                    </p>
                  </div>
                </div>

                {/* 4 Stat Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full md:w-auto">
                  <div className="bg-[#F8FAF9] border border-zinc-200/70 rounded-2xl p-3 text-center min-w-[90px]">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Serving</p>
                    <p className="font-black text-sm text-zinc-900 mt-0.5 truncate">
                      {servingUser ? `Token #${activeUsers.indexOf(servingUser) + 1}` : 'Available'}
                    </p>
                  </div>
                  <div className="bg-[#F8FAF9] border border-zinc-200/70 rounded-2xl p-3 text-center min-w-[90px]">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Waiting</p>
                    <p className="font-black text-sm text-zinc-900 mt-0.5">
                      {waitingUsers.length} in line
                    </p>
                  </div>
                  <div className="bg-[#F8FAF9] border border-zinc-200/70 rounded-2xl p-3 text-center min-w-[90px]">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Est. Wait</p>
                    <p className="font-black text-sm text-[#16A34A] mt-0.5">
                      {activeUsers.length === 0 ? '0 mins' : `~${activeUsers.length * (activeBusiness.averageServiceTime || 15)}m`}
                    </p>
                  </div>
                  <div className="bg-[#F8FAF9] border border-zinc-200/70 rounded-2xl p-3 text-center min-w-[90px]">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Staff</p>
                    <p className="font-black text-sm text-zinc-900 mt-0.5">
                      {(activeBusiness.staff || []).length || 1} on duty
                    </p>
                  </div>
                </div>
              </div>

              {/* 2-Column Board: Join Queue (Left) & The Actual Queue (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
                {/* ── LEFT: JOIN THE LIVE QUEUE CARD ── */}
                <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs flex flex-col justify-between space-y-6">
                  <div className="space-y-5">
                    {/* Header */}
                    <div>
                      <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
                        <Ticket className="w-3.5 h-3.5" />
                        <span>JOIN LIVE QUEUE</span>
                      </span>
                      <h3 className="text-2xl font-black text-zinc-950 mt-3 tracking-tight">
                        Take a Digital Token
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Get in line digitally at {activeBusiness.name}. You don't need to stand and wait physically.
                      </p>
                    </div>

                    {/* Service Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-700 block">
                        Select Service
                      </label>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {(activeBusiness.services?.length > 0
                          ? activeBusiness.services
                          : [
                              {
                                name: activeBusiness.category === 'clinic' ? 'General Consultation' : 'Haircut & Styling',
                                duration: activeBusiness.averageServiceTime || 15,
                                price: activeBusiness.basePrice || 0,
                              },
                            ]
                        ).map((s, idx) => {
                          const isSel = (selectedService?.name || '') === s.name
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedService(s)}
                              className={`w-full text-left p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                isSel
                                  ? 'bg-[#EAF7EE] border-[#16A34A] text-[#114227]'
                                  : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="font-bold truncate">{s.name}</p>
                                <p className="text-[10px] text-zinc-400">{s.duration || 15} mins</p>
                              </div>
                              <span className="font-bold text-xs shrink-0">
                                {s.price ? `₹${s.price}` : 'Free / At Desk'}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Specialist Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-700 block">
                        Preferred Specialist
                      </label>
                      <select
                        value={selectedStaff}
                        onChange={(e) => setSelectedStaff(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="any">Any Available Specialist (Fastest)</option>
                        {(activeBusiness.staff || []).map((st, sIdx) => (
                          <option key={sIdx} value={st.name}>
                            {st.name} {st.role ? `(${st.role})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Queue Preview Info Box */}
                    <div className="rounded-2xl bg-[#F4FAF6] border border-[#D5EFE0] p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                          Next Token
                        </p>
                        <p className="text-lg font-black text-[#114227]">
                          #{activeUsers.length + 1}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                          Est. Wait Time
                        </p>
                        <p className="text-sm font-bold text-zinc-800">
                          {activeUsers.length === 0 ? 'Immediate' : `~${activeUsers.length * (activeBusiness.averageServiceTime || 15)} mins`}
                        </p>
                      </div>
                    </div>

                    {/* Pay at Counter Notice Box */}
                    <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3.5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">
                            Payment • Pay at Counter
                          </p>
                        </div>
                        <p className="text-xs text-amber-950 font-medium">
                          Pay directly to business staff upon arrival.
                        </p>
                      </div>
                      <div className="text-right shrink-0 pl-3">
                        <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                          To Pay
                        </p>
                        <p className="text-base font-black text-amber-950">
                          ₹{selectedService?.price ?? (activeBusiness.services?.[0]?.price || activeBusiness.basePrice || 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Primary Join Button */}
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      disabled={joiningQueue || !activeBusiness.isOpen}
                      onClick={() => handleJoinQueue(activeBusiness)}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#114227] hover:bg-[#0D361F] disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-98 cursor-pointer"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>
                        {joiningQueue
                          ? 'Taking Token...'
                          : activeBusiness.isOpen
                          ? `Join Live Queue • Get Token #${activeUsers.length + 1}`
                          : 'Currently Closed'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/booking/${activeBusiness._id}`)}
                      className="w-full py-2.5 text-center text-xs font-semibold text-zinc-500 hover:text-emerald-700 transition-colors cursor-pointer"
                    >
                      Schedule for later instead →
                    </button>
                  </div>
                </div>

                {/* ── RIGHT: THE ACTUAL LIVE QUEUE BOARD ── */}
                <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* Header with Live Indicator */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
                        </span>
                        <h3 className="font-black text-sm uppercase tracking-wider text-zinc-950">
                          Live Queue Board
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-500">
                          {activeUsers.length} total in stream
                        </span>
                        <button
                          type="button"
                          onClick={() => fetchData()}
                          className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 cursor-pointer transition-colors"
                          title="Refresh live board"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Section 1: Currently Being Served */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Now Serving at Counter</span>
                      </p>

                      {servingUser ? (
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F4FAF6] to-[#EAF7EE] border border-[#BDE8CB] flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-[#114227] text-white flex flex-col items-center justify-center shrink-0 shadow-2xs">
                              <span className="text-[9px] font-bold uppercase opacity-80">TOKEN</span>
                              <span className="font-black text-base leading-tight">
                                #{activeUsers.indexOf(servingUser) + 1}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm text-zinc-950 truncate">
                                  {servingUser.serviceType || 'General Service'}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                  SERVING NOW
                                </span>
                              </div>
                              <p className="text-xs text-zinc-600 truncate mt-0.5 flex items-center gap-1">
                                <User className="w-3 h-3 text-zinc-400" />
                                <span>Specialist: <strong>{servingUser.assignedStaff?.name || assignedSpecialist.name}</strong></span>
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Finish ETA</p>
                            <p className="font-black text-xs text-[#114227]">{timeMetrics.finishEtaStr}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-center text-xs text-zinc-500 font-medium">
                          Counters are currently clear. Join now to be served right away!
                        </div>
                      )}
                    </div>

                    {/* Section 2: Waiting in Line (The Live Waitlist) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Waiting in Line ({waitingUsers.length})</span>
                        </p>
                        <span className="text-[10px] text-zinc-400 font-semibold">
                          Chronological Order
                        </span>
                      </div>

                      {waitingUsers.length > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {waitingUsers.map((u, idx) => {
                            const pos = activeUsers.indexOf(u) + 1
                            return (
                              <div
                                key={idx}
                                className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 text-zinc-800 font-black flex items-center justify-center shrink-0">
                                    #{pos}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-zinc-900 truncate">
                                      {u.serviceType || 'General Service'}
                                    </p>
                                    <p className="text-[10px] text-zinc-500 truncate">
                                      With {u.assignedStaff?.name || 'On-Duty Specialist'}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    WAITING
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="p-5 rounded-2xl bg-[#F8FAF9] border border-dashed border-zinc-200 text-center space-y-1">
                          <p className="font-bold text-xs text-zinc-800">No Waiting Line</p>
                          <p className="text-[11px] text-zinc-500">
                            {servingUser
                              ? 'There is 1 person being served and 0 people waiting behind them.'
                              : 'The queue is completely empty! You will be first in line.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Quick Action */}
                  <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">
                      Need to see all counter streams?
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowLiveStreamModal(true)}
                      className="font-bold text-[#114227] hover:text-[#0D361F] flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Counter Stream</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Callout: Booking Alternative */}
              <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#EAF7EE] border border-[#BDE8CB] text-[#16A34A] flex items-center justify-center shrink-0">
                    <Calendar className="w-6 h-6 text-[#16A34A]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-950 text-sm sm:text-base">
                      Plan ahead instead of waiting?
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Book an appointment with your preferred specialist at a guaranteed time slot.
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