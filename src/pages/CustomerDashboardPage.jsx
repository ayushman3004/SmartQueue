import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import {
  MapPin,
  Search,
  Wallet,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  LayoutDashboard,
  Stethoscope,
  Scissors,
  Ticket,
  Calendar,
  Star,
  Clock,
  HelpCircle,
  MessageSquare,
  LogOut,
  Users,
  User,
  Map,
  X,
  CheckCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getAllBusinesses } from '../api/business.api'
import { joinQueue, leaveQueue } from '../api/queue.api'
import { getMyBookings, cancelBooking } from '../api/booking.api'
import { getAvailableCoupons } from '../api/coupon.api'
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

// High-quality imagery matching the modern clinic and salon aesthetic in the screenshot
const DEFAULT_CLINIC_IMAGES = [
  'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=700&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=700&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=700&auto=format&fit=crop&q=80',
]

const DEFAULT_SALON_IMAGES = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=700&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=700&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?w=700&auto=format&fit=crop&q=80',
]

export default function CustomerDashboardPage() {
  const { user, setUser, logOut } = useAuth()
  const navigate = useNavigate()
  const { onBusinessStatus, socket } = useSocket()

  useSeo({
    title: 'Customer Dashboard & Queues — serveQ',
    description: 'Join live queues or book appointments at trusted clinics and salons near you.',
    robots: 'noindex, nofollow',
  })

  // State
  const [businesses, setBusinesses] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [joiningBizId, setJoiningBizId] = useState(null)
  const [leavingBizId, setLeavingBizId] = useState(null)

  // Navigation & Filtering
  const [activeNavTab, setActiveNavTab] = useState('dashboard') // 'dashboard' | 'clinics' | 'salons' | 'my-queues' | 'appointments' | 'reviews' | 'history'
  const [categoryFilter, setCategoryFilter] = useState('all') // 'all' | 'clinic' | 'salon'
  const [search, setSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState('Kolkata, West Bengal')
  const [locationQuery, setLocationQuery] = useState('')
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all') // 'all' | 'live_queue' | 'appointment' | 'completed' | 'upcoming'
  const [sortBy, setSortBy] = useState('nearest') // 'nearest' | 'wait_time' | 'rating'
  const [showMapModal, setShowMapModal] = useState(false)

  const debouncedSearch = useDebounce(search, 350)
  const debouncedLocation = useDebounce(locationQuery, 350)

  // Selected services & staff for inline join
  const [selectedServices, setSelectedServices] = useState({})
  const [selectedStaff, setSelectedStaff] = useState({})

  // Review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBookingForReview, setSelectedBookingForReview] = useState(null)
  const [rating, setRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Fetch initial dashboard data
  const fetchData = useCallback(async () => {
    try {
      const [allRes, myBkRes, coupRes] = await Promise.all([
        getAllBusinesses({
          search: debouncedSearch,
          category: categoryFilter,
          location: debouncedLocation,
          includeAll: false,
        }),
        getMyBookings().catch(() => ({ data: { data: { bookings: [] } } })),
        getAvailableCoupons().catch(() => ({ data: { data: { coupons: [] } } })),
      ])

      const bizList = allRes.data.data.businesses || []
      setBusinesses(bizList)
      setMyBookings(myBkRes.data.data.bookings || [])
      setCoupons(coupRes.data.data.coupons || [])

      setSelectedServices((prev) => {
        const next = { ...prev }
        bizList.forEach((b) => {
          if (!next[b._id]) {
            next[b._id] = b.services?.length
              ? [b.services[0]]
              : [
                  {
                    name: 'General Service',
                    duration: b.averageServiceTime || 15,
                    price: b.basePrice || 0,
                  },
                ]
          }
        })
        return next
      })

      setSelectedStaff((prev) => {
        const next = { ...prev }
        bizList.forEach((b) => {
          if (!next[b._id]) {
            next[b._id] = 'any'
          }
        })
        return next
      })
    } catch (err) {
      console.error('Customer Dashboard fetch error:', err)
      toast.error('Could not refresh present queues')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, categoryFilter, debouncedLocation])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time socket listeners
  useEffect(() => {
    if (!socket) return

    const unsubStatus = onBusinessStatus?.((data) => {
      setBusinesses((prev) =>
        prev.map((b) =>
          b._id === data.businessId ? { ...b, isOpen: data.isOpen, isActive: data.isActive } : b
        )
      )
    })

    const handleQueueChange = (updatedQueue) => {
      if (!updatedQueue) return
      const targetBizId = updatedQueue.businessId?._id || updatedQueue.businessId

      setBusinesses((prev) =>
        prev.map((b) => {
          if (b._id === targetBizId || b._id === updatedQueue._id) {
            const users = updatedQueue.users || []
            let waitMins = 0
            if (users.length > 0) {
              const totalMins = users.reduce((acc, u) => acc + (u.serviceTime || 15), 0)
              waitMins = totalMins + users.length * 15
            }
            return {
              ...b,
              queueLength: users.length,
              estimatedWait: waitMins,
              activeQueue: users,
            }
          }
          return b
        })
      )
    }

    const handleBookingsChange = () => {
      getMyBookings()
        .then((myBkRes) => setMyBookings(myBkRes.data?.data?.bookings || []))
        .catch(() => {})
    }

    socket.on('queue:update', handleQueueChange)
    socket.on('queue:updated', (data) => handleQueueChange(data?.queue))
    socket.on('queue:joined', (data) => handleQueueChange(data?.queue))
    socket.on('queue:left', (data) => handleQueueChange(data?.queue))
    socket.on('service:started', (data) => handleQueueChange(data?.queue))
    socket.on('service:completed', (data) => {
      handleQueueChange(data?.queue)
      handleBookingsChange()
    })
    socket.on('bookings:updated', handleBookingsChange)
    socket.on('booking:confirmed', handleBookingsChange)

    return () => {
      unsubStatus?.()
      socket.off('queue:update', handleQueueChange)
      socket.off('queue:updated')
      socket.off('queue:joined')
      socket.off('queue:left')
      socket.off('service:started')
      socket.off('service:completed')
      socket.off('bookings:updated', handleBookingsChange)
      socket.off('booking:confirmed', handleBookingsChange)
    }
  }, [socket, onBusinessStatus])

  // Compute active queues where current user is in line
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
        const peopleAhead = Math.max(0, foundIdx)
        const servingItem = qUsers.find((u) => u.status === 'serving')

        active.push({
          business: biz,
          myQueueItem: myItem,
          position,
          peopleAhead,
          totalInQueue: qUsers.length,
          isServing: myItem.status === 'serving' || foundIdx === 0,
          servingToken: servingItem ? qUsers.indexOf(servingItem) + 1 : 1,
          estimatedStartTime: myItem.estimatedStartTime,
        })
      }
    })

    return active
  }, [businesses, user?._id])

  // Unified records merging Active Live Queues + Booked Appointments + Completed Service History
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
        serviceType: qItem.serviceType || 'General Service',
        services: qItem.services || [],
        assignedStaff: qItem.assignedStaff || { name: '', role: '' },
        paidAmount: qItem.paidAmount || 0,
        status: activeQ.isServing ? 'serving' : 'waiting',
        startTime: qItem.joinedAt || qItem.estimatedStartTime || new Date(),
        entryType: 'live_queue',
        isLiveQueue: true,
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

      list.push({
        ...bk,
        entryType: isQ ? 'live_queue' : 'appointment',
        isLiveQueue: isQ,
        isAppointment: !isQ,
        businessName: bk.businessId?.name || 'Local Venue',
      })
    })

    return list.sort((a, b) => {
      const aActive = ['serving', 'waiting', 'confirmed', 'scheduled'].includes(a.status) ? 1 : 0
      const bActive = ['serving', 'waiting', 'confirmed', 'scheduled'].includes(b.status) ? 1 : 0
      if (aActive !== bActive) return bActive - aActive
      return new Date(b.startTime || b.createdAt || 0) - new Date(a.startTime || a.createdAt || 0)
    })
  }, [myActiveQueues, myBookings, user?._id])

  const clinicsList = useMemo(() => {
    return businesses.filter(
      (b) => b.category === 'clinic' || b.category === 'healthcare' || b.category === 'doctor'
    )
  }, [businesses])

  const salonsList = useMemo(() => {
    return businesses.filter(
      (b) => b.category === 'salon' || b.category === 'barbershop' || b.category === 'beauty'
    )
  }, [businesses])

  const displayedServices = useMemo(() => {
    if (categoryFilter === 'clinic') return clinicsList
    if (categoryFilter === 'salon') return salonsList
    return businesses
  }, [categoryFilter, clinicsList, salonsList, businesses])

  // Quick Join Queue Handler
  const handleJoinQueue = async (biz) => {
    if (biz.queueSettings?.enableLiveQueue === false) {
      toast.error('Live queue is currently disabled for this business.')
      return
    }
    if (!biz.isOpen) {
      toast.error('This business is currently closed for check-ins.')
      return
    }

    const services = biz.services || []
    const curServices =
      selectedServices[biz._id] ||
      (services.length > 0
        ? [services[0]]
        : [{ name: 'General Service', duration: biz.averageServiceTime || 15, price: biz.basePrice || 0 }])
    const curStaff = selectedStaff[biz._id] || 'any'
    const preferredStaffName =
      curStaff === 'any' ? null : typeof curStaff === 'string' ? curStaff : curStaff.name
    const paymentMethod =
      biz.paymentConfiguration?.paymentMode === 'ONLINE' ? 'WALLET' : 'PAY_AT_BUSINESS'

    setJoiningBizId(biz._id)

    try {
      const res = await joinQueue(biz._id, {
        services: curServices,
        serviceType: curServices.map((s) => s.name).join(', '),
        preferredStaff: preferredStaffName,
        paymentMethod,
      })
      const updatedQ = res.data.data.queue

      setBusinesses((prev) =>
        prev.map((b) =>
          b._id === biz._id
            ? { ...b, activeQueue: updatedQ.users, queueLength: updatedQ.users.length }
            : b
        )
      )

      getMyBookings()
        .then((myBkRes) => setMyBookings(myBkRes.data?.data?.bookings || []))
        .catch(() => {})

      toast.success(`You joined the queue at ${biz.name}!`)
    } catch (err) {
      if (err.response?.status === 400 || err.response?.data?.message?.includes('already')) {
        toast('You are already registered in this queue.')
        navigate(`/queue/${biz._id}`)
      } else {
        toast.error(err.response?.data?.message || 'Failed to join queue')
      }
    } finally {
      setJoiningBizId(null)
    }
  }

  // Quick Leave Queue Handler
  const handleLeaveQueue = async (bizId, bizName) => {
    if (!window.confirm(`Leave queue at ${bizName}? You will lose your current token position.`)) return

    setLeavingBizId(bizId)
    try {
      const res = await leaveQueue(bizId)
      const updatedQ = res.data.data.queue

      setBusinesses((prev) =>
        prev.map((b) =>
          b._id === bizId
            ? { ...b, activeQueue: updatedQ.users, queueLength: updatedQ.users.length }
            : b
        )
      )

      getMyBookings()
        .then((myBkRes) => setMyBookings(myBkRes.data?.data?.bookings || []))
        .catch(() => {})

      toast.success(`Left queue at ${bizName}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not leave queue')
    } finally {
      setLeavingBizId(null)
    }
  }

  // Cancel Booking
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Cancel this appointment? Pre-paid amounts will be refunded to your wallet.')) return
    try {
      const res = await cancelBooking(bookingId)
      toast.success(res.data.message || 'Booking cancelled and refunded')
      getMyBookings().then((r) => setMyBookings(r.data.data.bookings || []))
      if (res.data.data?.refunded) {
        setUser((prev) =>
          prev ? { ...prev, walletBalance: (prev.walletBalance || 0) + res.data.data.refunded } : prev
        )
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel booking')
    }
  }

  const handleOpenReview = (booking) => {
    setSelectedBookingForReview(booking)
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
      getMyBookings().then((r) => setMyBookings(r.data.data.bookings || []))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  // Helper to render Business Card matching the exact screenshot design
  const renderBusinessCard = (biz, defaultImg) => {
    const isUserInQueue = myActiveQueues.some((q) => q.business._id === biz._id)
    const userQInfo = myActiveQueues.find((q) => q.business._id === biz._id)
    const activeUsers = biz.activeQueue || []
    const servingUser = activeUsers.find((u) => u.status === 'serving') || activeUsers[0]
    const servingTokenNum = servingUser ? String(activeUsers.indexOf(servingUser) + 1).padStart(2, '0') : '01'
    const waitingCount = Math.max(0, activeUsers.length - (servingUser ? 1 : 0))
    const estWaitMins = activeUsers.length > 0 ? (biz.estimatedWait || activeUsers.length * 12) : 0

    const photoUrl =
      biz.coverImage ||
      biz.logo ||
      (biz.category === 'clinic' ? defaultImg || DEFAULT_CLINIC_IMAGES[0] : defaultImg || DEFAULT_SALON_IMAGES[0])

    const distanceDisplay = biz.distance ? `${biz.distance.toFixed(1)} km` : '1.2 km'
    const avgRating = biz.averageRating || 4.8
    const reviewCount = biz.reviewCount || 320
    const servicesList = biz.services?.length
      ? biz.services
      : [{ name: 'General Consultation' }, { name: 'Health Checkup' }]

    return (
      <div
        key={biz._id}
        className="bg-white border border-zinc-200/90 rounded-2xl sm:rounded-3xl shadow-xs overflow-hidden hover:shadow-md transition-all flex flex-col justify-between group"
      >
        {/* Photo Banner */}
        <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-zinc-100">
          <img
            src={photoUrl}
            alt={biz.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

          {/* Overlaid Top Badges */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                biz.isOpen
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs'
                  : 'bg-rose-100 text-rose-800 border border-rose-300 shadow-xs'
              }`}
            >
              {biz.isOpen ? 'OPEN' : 'CLOSED'}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold text-zinc-800 bg-white/95 backdrop-blur-xs border border-zinc-200/80 shadow-xs capitalize">
              {biz.category === 'salon' || biz.category === 'barbershop' || biz.category === 'beauty'
                ? 'Salon'
                : 'Clinic'}
            </span>
          </div>

          <div className="absolute top-3 right-3">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold text-zinc-800 bg-white/95 backdrop-blur-xs border border-zinc-200/80 shadow-xs flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-zinc-500" />
              <span>{distanceDisplay}</span>
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 space-y-3.5">
          {/* Header & Rating */}
          <div>
            <h3 className="font-black text-lg text-zinc-950 tracking-tight leading-snug line-clamp-1">
              {biz.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="font-black text-zinc-900">{avgRating.toFixed(1)}</span>
              <span className="text-zinc-500 font-medium">({reviewCount}+ reviews)</span>
            </div>
            <p className="text-zinc-500 text-xs mt-1 flex items-center gap-1 line-clamp-1">
              <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>{biz.location || biz.address || 'Kolkata, West Bengal'}</span>
            </p>
          </div>

          {/* 3-Column Live Queue Panel */}
          <div className="bg-[#F4F8F5] border border-[#E3EDE5] rounded-2xl p-2.5 grid grid-cols-3 text-center divide-x divide-[#E0EBE2]">
            <div className="px-1">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Now Serving</p>
              <p className="text-sm sm:text-base font-black text-[#114227] mt-0.5">#{servingTokenNum}</p>
            </div>
            <div className="px-1">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Waiting</p>
              <p className="text-xs sm:text-sm font-bold text-zinc-800 mt-0.5">
                {waitingCount} <span className="text-[10px] text-zinc-500 font-normal">in line</span>
              </p>
            </div>
            <div className="px-1">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Est. Wait</p>
              <p className="text-xs sm:text-sm font-black text-amber-700 mt-0.5">
                ~{estWaitMins} <span className="text-[10px] text-amber-600 font-normal">min</span>
              </p>
            </div>
          </div>

          {/* Service Pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {servicesList.slice(0, 3).map((s, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-xl text-[10px] font-semibold bg-zinc-100/90 text-zinc-700 border border-zinc-200/60 inline-flex items-center gap-1"
              >
                <User className="w-2.5 h-2.5 text-zinc-400" />
                <span className="line-clamp-1">{s.name}</span>
              </span>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
            {isUserInQueue ? (
              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={() => navigate(`/queue/${biz._id}`)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-transform active:scale-98"
                >
                  <span>In Line (Token #{userQInfo?.position || 1})</span>
                </button>
                <button
                  onClick={() => handleLeaveQueue(biz._id, biz.name)}
                  disabled={leavingBizId === biz._id}
                  className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center justify-center"
                  title="Leave Queue"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleJoinQueue(biz)}
                disabled={!biz.isOpen || joiningBizId === biz._id}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#114227] hover:bg-[#0D361F] disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-transform active:scale-98"
              >
                {joiningBizId === biz._id ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Joining...</span>
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5" />
                    <span>Join Live Queue</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => navigate(`/booking/${biz._id}`)}
              disabled={biz.bookingSettings?.enableAppointments === false}
              className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>Book Appointment</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-zinc-900 flex flex-col font-sans">
      {/* ── TOP HEADER BAR ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group text-decoration-none">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 font-sans flex items-center">
              serve<span className="text-emerald-600">q</span>
            </span>
          </Link>
        </div>

        {/* Center: Location Pill & Search Bar */}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-2xl mx-4">
          {/* Location Selector Pill */}
          <div className="relative">
            <button
              onClick={() => setShowLocationPicker((prev) => !prev)}
              className="px-3.5 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/60 text-xs font-semibold text-zinc-800 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              <span>{selectedCity}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {/* Location dropdown */}
            {showLocationPicker && (
              <div className="absolute top-full left-0 mt-1.5 w-60 bg-white border border-zinc-200 rounded-2xl shadow-xl p-2 z-50 space-y-1">
                <p className="text-[10px] font-bold uppercase text-zinc-400 px-2 py-1">Select Location</p>
                {POPULAR_LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => {
                      setSelectedCity(loc)
                      setLocationQuery(loc.split(',')[0])
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

          {/* Search Input Bar */}
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
          {/* Wallet Balance Pill */}
          <button
            onClick={() => navigate('/wallet')}
            className="px-3.5 py-1.5 rounded-full bg-[#EAF7EE] border border-[#BDE8CB] hover:bg-[#DDF3E3] text-xs font-bold text-[#114227] flex items-center gap-2 transition-all shadow-xs"
          >
            <Wallet className="w-3.5 h-3.5 text-[#114227]" />
            <span>₹{(user?.walletBalance ?? 0).toLocaleString()}</span>
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => toast('No new notifications', { icon: 'info' })}
              className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors relative"
            >
              <Bell className="w-4 h-4 text-zinc-600" />
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-2 border-2 border-white" />
            </button>
          </div>

          {/* User Profile Avatar with dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-zinc-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-700 text-white flex items-center justify-center font-bold text-xs border border-zinc-200">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
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
                    navigate('/wallet')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl flex items-center gap-2"
                >
                  <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Wallet & Top-up</span>
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

      {/* ── BODY: SIDEBAR + MAIN CANVAS (FULL SCREEN) ── */}
      <div className="flex-1 flex w-full">
        {/* LEFT SIDEBAR */}
        <aside className="w-56 shrink-0 hidden lg:flex flex-col justify-between py-5 px-4 border-r border-zinc-200/70 min-h-[calc(100vh-61px)] bg-white/40">
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, count: null },
              { id: 'clinics', label: 'Clinics', icon: Stethoscope, count: clinicsList.length },
              { id: 'salons', label: 'Salons', icon: Scissors, count: salonsList.length },
              { id: 'my-queues', label: 'My Queues', icon: Ticket, count: myActiveQueues.length },
              {
                id: 'appointments',
                label: 'Appointments',
                icon: Calendar,
                count: myBookings.filter(
                  (b) => b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'refunded'
                ).length,
              },
              { id: 'reviews', label: 'Reviews', icon: Star, count: null },
              { id: 'history', label: 'History', icon: Clock, count: null },
            ].map((item) => {
              const isActive = activeNavTab === item.id
              const IconComponent = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveNavTab(item.id)
                    if (item.id === 'clinics') setCategoryFilter('clinic')
                    else if (item.id === 'salons') setCategoryFilter('salon')
                    else if (item.id === 'dashboard') setCategoryFilter('all')
                    else if (item.id === 'history') {
                      document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' })
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#EAF5EC] text-[#114227] shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className={`w-4 h-4 ${isActive ? 'text-[#114227]' : 'text-zinc-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== null && item.count > 0 && (
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

          {/* Bottom Sidebar: Help & Support */}
          <div className="pt-4 border-t border-zinc-100">
            <button
              onClick={() => toast('Support hotline: help@serveq.tech', { icon: 'info' })}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-zinc-500" />
              <span>Help & Support</span>
            </button>
          </div>
        </aside>

        {/* MAIN CANVAS */}
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-5 space-y-6 min-w-0">
          {/* Active Live Queues Callout (If user is currently in line) */}
          {myActiveQueues.length > 0 && (
            <div className="bg-gradient-to-r from-teal-900 to-emerald-950 text-white rounded-3xl p-5 sm:p-6 shadow-lg border border-teal-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-xl font-black text-white shrink-0">
                  #{myActiveQueues[0].position}
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/30 text-teal-200 text-[10px] font-black uppercase tracking-wider mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                    {myActiveQueues[0].isServing ? 'You are being served now!' : 'Active Live Queue Token'}
                  </div>
                  <h4 className="text-base font-black text-white">
                    {myActiveQueues[0].business.name}
                  </h4>
                  <p className="text-xs text-teal-200 font-medium">
                    {myActiveQueues[0].peopleAhead === 0
                      ? 'You are next in line!'
                      : `${myActiveQueues[0].peopleAhead} patrons ahead of you`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/queue/${myActiveQueues[0].business._id}`)}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-black text-xs shadow-sm transition-transform active:scale-95"
                >
                  View Live Screen
                </button>
                <button
                  onClick={() =>
                    handleLeaveQueue(myActiveQueues[0].business._id, myActiveQueues[0].business.name)
                  }
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-rose-300 font-bold text-xs border border-white/10"
                >
                  Leave
                </button>
              </div>
            </div>
          )}

          {/* ── HERO BANNER ── */}
          <div className="w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#D5EEDB] shadow-xs bg-[#EAF7EE]">
            <img
              src="/hero-banner.png"
              srcSet="/hero-banner.png 1x, /hero-banner@2x.png 2x"
              alt="Skip the wait. Live smarter. Join live queues, book appointments and get real-time updates at your favourite clinics, salons and more."
              className="w-full h-auto object-cover block select-none"
              loading="eager"
            />
          </div>

          {/* ── FILTER & SORT CONTROLS BAR ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Category Pills (Left) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCategoryFilter(categoryFilter === 'clinic' ? 'all' : 'clinic')
                  setActiveNavTab('clinics')
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  categoryFilter === 'clinic'
                    ? 'bg-[#114227] text-white shadow-xs'
                    : 'bg-white border border-zinc-200/90 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <Stethoscope className={`w-3.5 h-3.5 ${categoryFilter === 'clinic' ? 'text-white' : 'text-zinc-500'}`} />
                <span>Clinics</span>
              </button>

              <button
                onClick={() => {
                  setCategoryFilter(categoryFilter === 'salon' ? 'all' : 'salon')
                  setActiveNavTab('salons')
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  categoryFilter === 'salon'
                    ? 'bg-[#114227] text-white shadow-xs'
                    : 'bg-white border border-zinc-200/90 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <Scissors className={`w-3.5 h-3.5 ${categoryFilter === 'salon' ? 'text-white' : 'text-zinc-500'}`} />
                <span>Salons</span>
              </button>

              {categoryFilter !== 'all' && (
                <button
                  onClick={() => {
                    setCategoryFilter('all')
                    setActiveNavTab('dashboard')
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>

            {/* Sort & Map View Pills (Right) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setSortBy((prev) => (prev === 'nearest' ? 'wait_time' : prev === 'wait_time' ? 'rating' : 'nearest'))
                }
                className="px-3.5 py-2 rounded-xl bg-white border border-zinc-200/90 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span>Sort by: {sortBy === 'nearest' ? 'Nearest' : sortBy === 'wait_time' ? 'Shortest Wait' : 'Top Rated'}</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              <button
                onClick={() => setShowMapModal(true)}
                className="px-3.5 py-2 rounded-xl bg-white border border-zinc-200/90 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Map className="w-3.5 h-3.5 text-zinc-600" />
                <span>Map View</span>
              </button>
            </div>
          </div>

          {/* ── SECTION: NEARBY SERVICES (CLINICS + SALONS IN ONE ROW) ── */}
          <section id="services-section" className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200/70 pb-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                  {categoryFilter === 'clinic'
                    ? 'Nearby Clinics'
                    : categoryFilter === 'salon'
                    ? 'Nearby Salons'
                    : 'Nearby Services'}
                </h2>
                <p className="text-xs text-zinc-500 font-medium">
                  {categoryFilter === 'clinic'
                    ? 'Join live queues or book appointments at clinics near you.'
                    : categoryFilter === 'salon'
                    ? 'Book appointments or join live queues at top-rated salons near you.'
                    : 'Join live queues or book appointments at verified clinics, salons & services near you.'}
                </p>
              </div>
              {categoryFilter !== 'all' ? (
                <button
                  onClick={() => {
                    setCategoryFilter('all')
                    setActiveNavTab('dashboard')
                  }}
                  className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 group"
                >
                  <span>Show All Services</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ) : (
                <div className="text-xs text-zinc-400 font-semibold">
                  {displayedServices.length} {displayedServices.length === 1 ? 'place' : 'places'} found
                </div>
              )}
            </div>

            {displayedServices.length === 0 ? (
              <div className="p-8 text-center bg-white border border-dashed border-zinc-200 rounded-3xl text-zinc-400 text-xs">
                No services found matching your current filter. Try searching a different location.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {displayedServices.map((biz, idx) => {
                  const isSalon =
                    biz.category === 'salon' || biz.category === 'barbershop' || biz.category === 'beauty'
                  const photoUrl =
                    biz.image ||
                    (isSalon
                      ? DEFAULT_SALON_IMAGES[idx % DEFAULT_SALON_IMAGES.length]
                      : DEFAULT_CLINIC_IMAGES[idx % DEFAULT_CLINIC_IMAGES.length])
                  return renderBusinessCard(biz, photoUrl)
                })}
              </div>
            )}
          </section>

          {/* ── SECTION 3: SERVICE HISTORY & APPOINTMENTS (LIVE QUEUES + BOOKINGS) ── */}
          <section id="history-section" className="space-y-4 pt-4 border-t border-zinc-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/70 pb-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
                  <span>Service History & Appointments</span>
                </h2>
                <p className="text-xs text-zinc-500 font-medium">
                  Complete history of services taken across all clinics, salons & hubs, with rating options.
                </p>
              </div>

              {/* Filter Pills matching exact tabs */}
              <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto bg-zinc-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setHistoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    historyFilter === 'all'
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  All ({unifiedServiceRecords.length})
                </button>
                <button
                  onClick={() => setHistoryFilter('live_queue')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    historyFilter === 'live_queue'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Live Queues (
                  {unifiedServiceRecords.filter((b) => b.isLiveQueue || b.entryType === 'live_queue').length})
                </button>
                <button
                  onClick={() => setHistoryFilter('appointment')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    historyFilter === 'appointment'
                      ? 'bg-white text-blue-800 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Appointments (
                  {unifiedServiceRecords.filter((b) => b.isAppointment || b.entryType === 'appointment').length})
                </button>
                <button
                  onClick={() => setHistoryFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    historyFilter === 'completed'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Completed ({unifiedServiceRecords.filter((b) => b.status === 'completed').length})
                </button>
                <button
                  onClick={() => setHistoryFilter('upcoming')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    historyFilter === 'upcoming'
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
            </div>

            {unifiedServiceRecords.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-3xl bg-white">
                No service history or appointment bookings on record yet. Completed services will appear here with rating options.
              </div>
            ) : (
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
                    {unifiedServiceRecords
                      .filter((b) => {
                        if (historyFilter === 'completed') return b.status === 'completed'
                        if (historyFilter === 'upcoming')
                          return ['waiting', 'serving', 'confirmed', 'scheduled'].includes(b.status)
                        if (historyFilter === 'live_queue') return b.isLiveQueue || b.entryType === 'live_queue'
                        if (historyFilter === 'appointment')
                          return b.isAppointment || b.entryType === 'appointment'
                        return true
                      })
                      .map((b) => {
                        const isQ = b.isLiveQueue || b.entryType === 'live_queue'
                        const isServing = b.status === 'serving'
                        const isWaiting = b.status === 'waiting'
                        const isCompleted = b.status === 'completed'
                        const isCancelled = b.status === 'cancelled' || b.status === 'refunded'
                        const bizId = b.businessId?._id || b.businessId
                        const bizName = b.businessId?.name || b.businessName || 'Local Venue'

                        return (
                          <tr
                            key={b._id}
                            className={`transition-colors ${
                              isServing ? 'bg-emerald-50/60' : 'hover:bg-zinc-50/70'
                            }`}
                          >
                            <td className="py-4 px-4 font-bold text-zinc-950">
                              {new Date(b.startTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              <p className="text-[10px] text-zinc-400 font-normal">
                                {new Date(b.startTime).toLocaleDateString([], {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </p>
                            </td>

                            <td className="py-4 px-4 font-bold text-zinc-900">{bizName}</td>

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
                                    : isServing
                                    ? 'bg-emerald-100 text-emerald-800 animate-pulse border border-emerald-300'
                                    : isWaiting
                                    ? 'bg-teal-100 text-teal-800 border border-teal-300'
                                    : isCancelled
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {isCompleted
                                  ? 'COMPLETED'
                                  : isServing
                                  ? 'SERVING NOW'
                                  : isWaiting
                                  ? `IN QUEUE (Token #${b.queuePosition || 1})`
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
                                    onClick={() => handleOpenReview(b)}
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
                                    onClick={() => handleCancelBooking(b._id)}
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
          </section>
        </main>
      </div>

      {/* ── MAP VIEW MODAL ── */}
      <AnimatePresence>
        {showMapModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="text-lg font-black text-zinc-950">Nearby Clinics & Salons Map</h3>
                <button
                  onClick={() => setShowMapModal(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="h-64 rounded-2xl bg-zinc-100 border border-zinc-200 flex flex-col items-center justify-center text-center p-6 space-y-2">
                <Map className="w-10 h-10 text-emerald-800" />
                <p className="text-xs font-bold text-zinc-800">Showing {businesses.length} Hubs near {selectedCity}</p>
                <p className="text-[11px] text-zinc-500">Live GPS tracking and walking routes enabled.</p>
              </div>
              <button
                onClick={() => setShowMapModal(false)}
                className="w-full py-2.5 bg-[#114227] text-white rounded-xl font-bold text-xs"
              >
                Close Map
              </button>
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
                        className={`text-2xl transition-transform hover:scale-110 ${
                          star <= rating ? 'text-amber-400' : 'text-zinc-200'
                        }`}
                      >
                        <Star className={`w-6 h-6 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-200 fill-zinc-200'}`} />
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
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#114227] text-white shadow-xs"
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
