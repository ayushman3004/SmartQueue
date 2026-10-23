import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
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
  X,
  Check,
  CheckCircle,
  ArrowUpDown,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  RotateCcw,
  Menu,
} from 'lucide-react'
import CustomerSidebar from '../components/CustomerSidebar'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getAllBusinesses } from '../api/business.api'
import { getMyBookings, cancelBooking } from '../api/booking.api'
import { submitReview } from '../api/review.api'
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

export default function HistoryPage() {
  const { user, setUser, logOut } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()

  useSeo({
    title: 'Service History & Appointments | serveQ',
    description: 'View your completed and active queues, appointments and leave verified reviews.',
  })

  // Data states
  const [businesses, setBusinesses] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters & Controls
  const [categoryFilter, setCategoryFilter] = useState('all') // 'all' | 'clinic' | 'salon'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'live_queue' | 'appointment' | 'completed' | 'upcoming'
  const [sortOrder, setSortOrder] = useState('newest') // 'newest' | 'oldest'
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  // UI Menus & Modals
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [selectedCity, setSelectedCity] = useState(POPULAR_LOCATIONS[0])
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBookingForReview, setSelectedBookingForReview] = useState(null)
  const [rating, setRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [selectedRecordDetails, setSelectedRecordDetails] = useState(null)

  // Fetch bookings and businesses
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [allRes, myBkRes] = await Promise.all([
        getAllBusinesses({ includeAll: false }),
        getMyBookings().catch(() => ({ data: { data: { bookings: [] } } })),
      ])
      setBusinesses(allRes.data?.data?.businesses || [])
      setMyBookings(myBkRes.data?.data?.bookings || [])
    } catch (err) {
      console.error('Failed to load history data:', err)
      toast.error('Unable to load history records')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time socket updates for live status changes
  useEffect(() => {
    if (!socket) return

    const handleQueueChange = () => {
      getMyBookings()
        .then((res) => setMyBookings(res.data?.data?.bookings || []))
        .catch(() => {})
    }

    socket.on('queue:update', handleQueueChange)
    socket.on('queue:updated', handleQueueChange)
    socket.on('service:started', handleQueueChange)
    socket.on('service:completed', handleQueueChange)
    socket.on('bookings:updated', handleQueueChange)
    socket.on('booking:confirmed', handleQueueChange)

    return () => {
      socket.off('queue:update', handleQueueChange)
      socket.off('queue:updated', handleQueueChange)
      socket.off('service:started', handleQueueChange)
      socket.off('service:completed', handleQueueChange)
      socket.off('bookings:updated', handleQueueChange)
      socket.off('booking:confirmed', handleQueueChange)
    }
  }, [socket])

  // Active queues for current user
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

  // Unified records merging Active Live Queues + Bookings + Service History
  const unifiedServiceRecords = useMemo(() => {
    const list = []
    const seenBookingIds = new Set()
    const activeBizIdsInQueue = new Set()

    myActiveQueues.forEach((activeQ) => {
      const qItem = activeQ.myQueueItem || {}
      const biz = activeQ.business || {}
      const bkId = qItem.bookingId ? qItem.bookingId.toString() : null
      if (bkId) seenBookingIds.add(bkId)
      if (biz._id) activeBizIdsInQueue.add(biz._id.toString())

      list.push({
        _id: bkId || `active_queue_${biz._id}_${user?._id}`,
        bookingId: bkId,
        businessId: biz,
        businessName: biz.name || 'Local Venue',
        businessCategory: biz.category || 'clinic',
        serviceType: qItem.serviceType || 'General Service',
        services: qItem.services || [],
        assignedStaff: qItem.assignedStaff || { name: '', role: '' },
        paidAmount: qItem.paidAmount || biz.basePrice || 0,
        status: activeQ.isServing ? 'serving' : 'waiting',
        startTime: qItem.joinedAt || qItem.estimatedStartTime || new Date(),
        entryType: 'live_queue',
        isLiveQueue: true,
        isAppointment: false,
        queuePosition: activeQ.position,
        tokenNumber: activeQ.position,
        peopleAhead: activeQ.peopleAhead,
        totalInQueue: activeQ.totalInQueue,
        isServing: activeQ.isServing,
        estimatedStartTime: activeQ.estimatedStartTime,
      })
    })

    myBookings.forEach((bk) => {
      const bId = bk._id ? bk._id.toString() : null
      if (bId && seenBookingIds.has(bId)) {
        return
      }

      const bizIdStr = (bk.businessId?._id || bk.businessId)?.toString()
      if (['waiting', 'serving'].includes(bk.status) && bizIdStr && activeBizIdsInQueue.has(bizIdStr)) {
        return
      }

      const isQ =
        bk.isLiveQueue ||
        bk.entryType === 'live_queue' ||
        bk.notes?.includes('Live Queue') ||
        ['waiting', 'serving'].includes(bk.status)

      const bCategory = bk.businessId?.category || 'clinic'

      list.push({
        ...bk,
        entryType: isQ ? 'live_queue' : 'appointment',
        isLiveQueue: isQ,
        isAppointment: !isQ,
        businessName: bk.businessId?.name || 'Local Venue',
        businessCategory: bCategory,
        paidAmount: bk.paidAmount || bk.price || 0,
      })
    })

    return list.sort((a, b) => {
      const timeA = new Date(a.startTime || a.createdAt || 0).getTime()
      const timeB = new Date(b.startTime || b.createdAt || 0).getTime()
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
    })
  }, [myActiveQueues, myBookings, user?._id, sortOrder])

  // Filtered list based on category filter, status filter, and search
  const filteredRecords = useMemo(() => {
    return unifiedServiceRecords.filter((record) => {
      // Category filter (All / Clinics / Salons)
      if (categoryFilter === 'clinic') {
        const cat = (record.businessCategory || '').toLowerCase()
        if (cat !== 'clinic' && cat !== 'healthcare' && cat !== 'doctor') return false
      }
      if (categoryFilter === 'salon') {
        const cat = (record.businessCategory || '').toLowerCase()
        if (cat !== 'salon' && cat !== 'barbershop' && cat !== 'beauty') return false
      }

      // Status filter
      if (statusFilter === 'completed' && record.status !== 'completed') return false
      if (statusFilter === 'upcoming') {
        if (!['waiting', 'serving', 'confirmed', 'scheduled'].includes(record.status)) return false
      }
      if (statusFilter === 'live_queue') {
        if (!record.isLiveQueue && record.entryType !== 'live_queue') return false
      }
      if (statusFilter === 'appointment') {
        if (!record.isAppointment && record.entryType !== 'appointment') return false
      }

      // Search term
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase()
        const bName = (record.businessName || '').toLowerCase()
        const sType = (record.serviceType || '').toLowerCase()
        const staff = (record.assignedStaff?.name || '').toLowerCase()
        if (!bName.includes(query) && !sType.includes(query) && !staff.includes(query)) {
          return false
        }
      }

      return true
    })
  }, [unifiedServiceRecords, categoryFilter, statusFilter, debouncedSearch])

  // Review handlers
  const handleOpenReview = (record, e) => {
    if (e) e.stopPropagation()
    setSelectedBookingForReview(record)
    setRating(5)
    setReviewComment('')
    setReviewModalOpen(true)
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    if (!selectedBookingForReview) return
    setSubmittingReview(true)
    try {
      await submitReview({
        bookingId: selectedBookingForReview._id,
        businessId: selectedBookingForReview.businessId?._id || selectedBookingForReview.businessId,
        rating,
        comment: reviewComment,
      })
      toast.success('Thank you! Review submitted successfully.')
      setReviewModalOpen(false)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleCancelBooking = async (bookingId, e) => {
    if (e) e.stopPropagation()
    if (!window.confirm('Are you sure you want to cancel this booking?')) return
    try {
      const res = await cancelBooking(bookingId)
      toast.success(res.data.message || 'Booking cancelled')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel booking')
    }
  }

  return (
    <div className="min-h-screen app-background-glow text-zinc-900 flex flex-col font-sans relative overflow-x-hidden">
      {/* ── TOP HEADER BAR ── */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
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
              className="px-3.5 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/60 text-xs font-semibold text-zinc-800 flex items-center gap-1.5 transition-colors whitespace-nowrap"
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
                    className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
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
              placeholder="Search history by clinic, salon, service or specialist..."
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
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors relative"
          >
            <Bell className="w-4 h-4 text-zinc-600" />
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-2 border-2 border-white" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-zinc-100 transition-colors"
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
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl flex items-center gap-2"
                >
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>View Profile</span>
                </button>
                <button
                  onClick={() => {
                    logOut()
                    navigate('/login')
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── BODY: SIDEBAR + MAIN CANVAS (MATCHING IMAGE 2) ── */}
      <div className="flex-1 flex w-full">
        {/* LEFT SIDEBAR (DESKTOP + ANIMATED MOBILE DRAWER) */}
        <CustomerSidebar
          activeNavTab="history"
          clinicsCount={businesses.filter((b) => b.category === 'clinic').length}
          salonsCount={businesses.filter((b) => b.category === 'salon' || b.category === 'barbershop').length}
          myActiveQueuesCount={myActiveQueues.length}
          myBookingsCount={
            myBookings.filter(
              (b) => b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'refunded'
            ).length
          }
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* MAIN CANVAS */}
        <main className="flex-1 px-4 py-5 sm:px-8 sm:py-7 space-y-6 min-w-0 max-w-6xl">
          {/* Header Section (Matching Image 2) */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight font-sans">
              Service History
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1">
              Your past queues and appointments at clinics and salons.
            </p>
          </div>

          {/* Filter & Sort Bar (Matching Image 2) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Left Category Filter Pills */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  categoryFilter === 'all'
                    ? 'bg-[#114227] text-white shadow-xs'
                    : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setCategoryFilter('clinic')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  categoryFilter === 'clinic'
                    ? 'bg-[#114227] text-white shadow-xs'
                    : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                Clinics
              </button>
              <button
                onClick={() => setCategoryFilter('salon')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  categoryFilter === 'salon'
                    ? 'bg-[#114227] text-white shadow-xs'
                    : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                Salons
              </button>
            </div>

            {/* Right Controls: Sort Order & View Mode */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Sort Order Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
                  className="px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-800 flex items-center gap-1.5 hover:bg-zinc-50 transition-colors shadow-2xs"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </button>
              </div>

              {/* View Switcher: Cards vs Table */}
              <div className="bg-zinc-100 p-1 rounded-xl flex items-center gap-1 text-xs">
                <button
                  onClick={() => setViewMode('cards')}
                  title="Card View (Image 2 style)"
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'cards' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  title="Table View (Image 1 style)"
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'table' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Sub-Filters / Tabs (Matching Image 1 tabs) */}
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100/90 p-1 rounded-xl text-xs font-bold self-start w-fit">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              All ({unifiedServiceRecords.length})
            </button>
            <button
              onClick={() => setStatusFilter('live_queue')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'live_queue'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Live Queues (
              {unifiedServiceRecords.filter((b) => b.isLiveQueue || b.entryType === 'live_queue').length})
            </button>
            <button
              onClick={() => setStatusFilter('appointment')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'appointment'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Appointments (
              {unifiedServiceRecords.filter((b) => b.isAppointment || b.entryType === 'appointment').length})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Completed ({unifiedServiceRecords.filter((b) => b.status === 'completed').length})
            </button>
            <button
              onClick={() => setStatusFilter('upcoming')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'upcoming'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Upcoming (
              {
                unifiedServiceRecords.filter(
                  (b) => ['waiting', 'serving', 'confirmed', 'scheduled'].includes(b.status)
                ).length
              }
              )
            </button>
          </div>

          {/* Records Display */}
          {loading ? (
            <div className="p-12 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-3xl bg-white space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-semibold text-zinc-600">Loading service history...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-3xl bg-white space-y-2">
              <p className="font-bold text-zinc-700 text-sm">No service history found</p>
              <p className="text-zinc-500 text-xs">
                Your completed services, live queues, and appointments will appear here with rating options.
              </p>
              <button
                onClick={() => navigate('/customers')}
                className="mt-3 px-4 py-2 bg-[#114227] text-white rounded-xl text-xs font-bold hover:bg-[#0D361F] transition-colors"
              >
                Browse Clinics & Salons
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            /* ── CARDS VIEW (MATCHING IMAGE 2 EXACTLY) ── */
            <div className="space-y-3">
              {filteredRecords.map((item) => {
                const isCompleted = item.status === 'completed'
                const isCancelled = item.status === 'cancelled' || item.status === 'refunded'
                const isServing = item.status === 'serving'
                const isWaiting = item.status === 'waiting'
                const isSalon =
                  (item.businessCategory || '').toLowerCase() === 'salon' ||
                  (item.businessCategory || '').toLowerCase() === 'barbershop' ||
                  (item.businessCategory || '').toLowerCase() === 'beauty'

                const dateObj = new Date(item.startTime || item.createdAt || Date.now())
                const dateStr = dateObj.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
                const timeStr = dateObj.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })

                return (
                  <div
                    key={item._id}
                    onClick={() => setSelectedRecordDetails(item)}
                    className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:shadow-xs hover:border-zinc-300 transition-all cursor-pointer group"
                  >
                    {/* Left: Icon + Business + Service + Specialist */}
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Rounded Square Icon matching Image 2 */}
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                          isCancelled
                            ? 'bg-rose-50 text-rose-600 border-rose-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}
                      >
                        {isSalon ? (
                          <Scissors className="w-5 h-5" />
                        ) : (
                          <Stethoscope className="w-5 h-5" />
                        )}
                      </div>

                      {/* Main Titles */}
                      <div className="min-w-0">
                        <h3 className="font-black text-zinc-950 text-sm sm:text-base tracking-tight truncate">
                          {item.businessName || 'Local Business'}
                        </h3>
                        <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">
                          {item.serviceType ||
                            (item.services && item.services[0]?.name) ||
                            'General Consultation'}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-600 font-medium">
                          <span className="flex items-center gap-1 text-zinc-500">
                            <User className="w-3.5 h-3.5 text-zinc-400" />
                            <span>
                              {item.assignedStaff?.name
                                ? `${item.assignedStaff.name} (${item.assignedStaff.role || (isSalon ? 'Stylist' : 'Physician')})`
                                : isSalon
                                ? 'On-Duty Stylist'
                                : 'On-Duty Doctor'}
                            </span>
                          </span>
                          {item.paidAmount > 0 && (
                            <span className="text-emerald-800 font-bold bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[11px]">
                              ₹{item.paidAmount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Date, Time, Status Badge & Rating CTA */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                      {/* Date & Time */}
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-bold text-zinc-800">{dateStr}</p>
                        <p className="text-[11px] text-zinc-400 font-medium">{timeStr}</p>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isCompleted ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]">
                            Completed
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
                            Cancelled
                          </span>
                        ) : isServing ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 animate-pulse border border-emerald-300">
                            Serving Now
                          </span>
                        ) : isWaiting ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            In Queue (#{item.queuePosition || 1})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                            {item.status}
                          </span>
                        )}
                      </div>

                      {/* Rating Action / Pill */}
                      {isCompleted && (
                        <div>
                          {item.review ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-xl text-xs font-bold">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                              <span className="text-amber-600 font-black">{item.review.rating}</span>
                              <span className="text-[10px] text-amber-700 font-medium hidden sm:inline">Rated</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleOpenReview(item, e)}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-xs transition-transform active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Star className="w-3.5 h-3.5 text-white fill-white" />
                              <span>Rate Service</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Right Chevron arrow */}
                      <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 group-hover:translate-x-0.5 transition-all ml-1" />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ── TABLE VIEW (MATCHING IMAGE 1) ── */
            <div className="overflow-x-auto bg-white rounded-3xl border border-zinc-200 shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase border-b border-zinc-100">
                  <tr>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Business</th>
                    <th className="py-3.5 px-4">Service & Specialist</th>
                    <th className="py-3.5 px-4">Paid</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Rating & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {filteredRecords.map((b) => {
                    const isCompleted = b.status === 'completed'
                    const isCancelled = b.status === 'cancelled' || b.status === 'refunded'
                    const isServing = b.status === 'serving'
                    const isWaiting = b.status === 'waiting'
                    const bizId = b.businessId?._id || b.businessId

                    return (
                      <tr
                        key={b._id}
                        className={`transition-colors ${
                          isServing ? 'bg-emerald-50/60' : 'hover:bg-zinc-50/70'
                        }`}
                      >
                        <td className="py-4 px-4 font-bold text-zinc-950">
                          {new Date(b.startTime || b.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          <p className="text-[10px] text-zinc-400 font-normal">
                            {new Date(b.startTime || b.createdAt).toLocaleDateString([], {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </p>
                        </td>

                        <td className="py-4 px-4 font-bold text-zinc-900">{b.businessName}</td>

                        <td className="py-4 px-4 text-zinc-700">
                          <p className="font-semibold text-zinc-950">{b.serviceType || 'General Service'}</p>
                          {b.assignedStaff?.name && (
                            <p className="text-[11px] font-bold text-teal-800 flex items-center gap-1 mt-0.5">
                              <span>{b.assignedStaff.name}</span>
                              <span className="text-[10px] text-zinc-400 font-normal">
                                ({b.assignedStaff.role || 'Dentist'})
                              </span>
                            </p>
                          )}
                        </td>

                        <td className="py-4 px-4 font-bold text-teal-700">₹{b.paidAmount}</td>

                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : isCancelled
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : isServing
                                ? 'bg-emerald-100 text-emerald-800 animate-pulse border border-emerald-300'
                                : isWaiting
                                ? 'bg-teal-100 text-teal-800 border border-teal-300'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {isCompleted
                              ? 'COMPLETED'
                              : isCancelled
                              ? 'REFUNDED'
                              : isServing
                              ? 'SERVING NOW'
                              : isWaiting
                              ? `IN QUEUE (#${b.queuePosition || 1})`
                              : b.status}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right space-x-2">
                          {isCompleted &&
                            (b.review ? (
                              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-xl text-xs font-bold">
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                <span className="text-amber-500 font-black">{b.review.rating}</span>
                                <span className="text-[10px] text-amber-700 font-semibold">Rated</span>
                              </span>
                            ) : (
                              <button
                                onClick={(e) => handleOpenReview(b, e)}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-xs transition-transform active:scale-95 inline-flex items-center gap-1.5"
                              >
                                <Star className="w-3.5 h-3.5 text-white fill-white" />
                                <span>Rate Service</span>
                              </button>
                            ))}

                          {(isWaiting || isServing) && bizId && (
                            <button
                              onClick={() => navigate(`/queue/${bizId}`)}
                              className="px-3 py-1.5 bg-[#114227] hover:bg-[#0D361F] text-white rounded-xl font-bold text-xs shadow-xs"
                            >
                              Track Queue
                            </button>
                          )}

                          {!isWaiting &&
                            !isServing &&
                            (b.status === 'scheduled' || b.status === 'confirmed') && (
                              <button
                                onClick={(e) => handleCancelBooking(b._id, e)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px]"
                              >
                                Cancel
                              </button>
                            )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* ── RECORD DETAILS MODAL ── */}
      <AnimatePresence>
        {selectedRecordDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="text-lg font-black text-zinc-950">
                    {selectedRecordDetails.businessName}
                  </h3>
                  <p className="text-xs text-zinc-500">Service Receipt & Details</p>
                </div>
                <button
                  onClick={() => setSelectedRecordDetails(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                  <span className="text-zinc-500 font-medium">Service Name</span>
                  <span className="font-bold text-zinc-900">
                    {selectedRecordDetails.serviceType || 'General Consultation'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                  <span className="text-zinc-500 font-medium">Assigned Specialist</span>
                  <span className="font-bold text-zinc-900">
                    {selectedRecordDetails.assignedStaff?.name || 'On-Duty Specialist'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                  <span className="text-zinc-500 font-medium">Status</span>
                  <span className="font-bold text-emerald-700 capitalize">
                    {selectedRecordDetails.status}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                  <span className="text-zinc-500 font-medium">Amount Paid</span>
                  <span className="font-black text-zinc-900 text-sm">
                    ₹{selectedRecordDetails.paidAmount || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
                  <span className="text-zinc-500 font-medium">Date & Timestamp</span>
                  <span className="font-semibold text-zinc-700">
                    {new Date(
                      selectedRecordDetails.startTime || selectedRecordDetails.createdAt
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100">
                {selectedRecordDetails.status === 'completed' && !selectedRecordDetails.review && (
                  <button
                    onClick={() => {
                      const item = selectedRecordDetails
                      setSelectedRecordDetails(null)
                      handleOpenReview(item)
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs"
                  >
                    <Star className="w-3.5 h-3.5 fill-white" />
                    <span>Rate Service</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedRecordDetails(null)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── REVIEW MODAL ── */}
      <AnimatePresence>
        {reviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <h3 className="text-lg font-black text-zinc-950">Leave a Verified Review</h3>
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Rating</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRating(star)}
                        className={`text-2xl transition-transform hover:scale-110 cursor-pointer ${
                          star <= rating ? 'text-amber-400' : 'text-zinc-200'
                        }`}
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-200 fill-zinc-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Your Experience (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Tell other patrons how your service went..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#114227] text-white shadow-xs cursor-pointer"
                  >
                    {submittingReview ? 'Submitting...' : 'Post Review'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
