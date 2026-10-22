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
  Check,
  CheckCircle,
  Eye,
  Sparkles,
  Activity,
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
  const [sortBy, setSortBy] = useState('nearest') // 'nearest' | 'wait_time' | 'rating'
  const [showMapModal, setShowMapModal] = useState(false)

  const debouncedSearch = useDebounce(search, 350)
  const debouncedLocation = useDebounce(locationQuery, 350)

  // Selected services & staff for inline join
  const [selectedServices, setSelectedServices] = useState({})
  const [selectedStaff, setSelectedStaff] = useState({})

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

  // Join socket rooms for all businesses to ensure live queue reception
  useEffect(() => {
    if (!socket || businesses.length === 0) return
    businesses.forEach((b) => {
      if (b._id) {
        socket.emit('join:room', { businessId: b._id })
      }
    })
  }, [socket, businesses])

  // Periodic background fallback sync every 12 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      getAllBusinesses({
        search: debouncedSearch,
        category: categoryFilter,
        location: debouncedLocation,
        includeAll: false,
      })
        .then((res) => {
          const bizList = res.data?.data?.businesses || []
          if (bizList.length > 0) {
            setBusinesses((prev) =>
              bizList.map((nb) => {
                const existing = prev.find((ob) => ob._id === nb._id)
                return existing ? { ...existing, ...nb } : nb
              })
            )
          }
        })
        .catch(() => {})
    }, 12000)

    return () => clearInterval(timer)
  }, [debouncedSearch, categoryFilter, debouncedLocation])

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

    const handleQueueChange = (payload) => {
      if (!payload) return
      const updatedQueue = payload.queue || payload
      const targetBizId = (updatedQueue.businessId?._id || updatedQueue.businessId || payload.businessId)?.toString()

      setBusinesses((prev) =>
        prev.map((b) => {
          if (b._id.toString() === targetBizId || b._id.toString() === updatedQueue._id?.toString()) {
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
    socket.on('queue:updated', handleQueueChange)
    socket.on('queue:joined', handleQueueChange)
    socket.on('queue:left', handleQueueChange)
    socket.on('service:started', handleQueueChange)
    socket.on('service:completed', (data) => {
      handleQueueChange(data)
      handleBookingsChange()
    })
    socket.on('bookings:updated', handleBookingsChange)
    socket.on('booking:confirmed', handleBookingsChange)

    return () => {
      unsubStatus?.()
      socket.off('queue:update', handleQueueChange)
      socket.off('queue:updated', handleQueueChange)
      socket.off('queue:joined', handleQueueChange)
      socket.off('queue:left', handleQueueChange)
      socket.off('service:started', handleQueueChange)
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

  // Toggle selection of service for a business
  const handleToggleService = (bizId, service) => {
    setSelectedServices((prev) => {
      const curList = prev[bizId] || []
      const exists = curList.some((s) => s.name === service.name)
      if (exists) {
        if (curList.length <= 1) {
          toast('At least one service must be selected')
          return prev
        }
        return {
          ...prev,
          [bizId]: curList.filter((s) => s.name !== service.name),
        }
      } else {
        return {
          ...prev,
          [bizId]: [...curList, service],
        }
      }
    })
  }

  // Quick Join Queue Handler (supports optional overrideStaff e.g. from Live Queue modal)
  const handleJoinQueue = async (biz, overrideStaff) => {
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
    const curStaff = overrideStaff !== undefined ? overrideStaff : (selectedStaff[biz._id] || 'any')
    const preferredStaffName =
      curStaff === 'any' ? null : typeof curStaff === 'string' ? curStaff : curStaff?.name
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

      if (overrideStaff !== undefined) {
        setSelectedStaff((prev) => ({
          ...prev,
          [biz._id]: overrideStaff,
        }))
      }

      getMyBookings()
        .then((myBkRes) => setMyBookings(myBkRes.data?.data?.bookings || []))
        .catch(() => {})

      toast.success(
        preferredStaffName
          ? `You joined ${preferredStaffName}'s queue at ${biz.name}!`
          : `You joined the live queue at ${biz.name}!`
      )
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

  // Helper to compute per-staff queue breakdown, personal wait times, and rush level
  const getStaffQueueBreakdown = useCallback((biz) => {
    if (!biz) return []
    const activeUsers = biz.activeQueue || []
    const rawStaff =
      Array.isArray(biz.staff) && biz.staff.length > 0
        ? biz.staff
        : [
            {
              name: biz.category === 'clinic' ? 'Dr. On-Duty (General Physician)' : 'On-Duty Specialist',
              role: biz.category === 'clinic' ? 'General Physician' : 'Barber / Stylist',
              specialties: biz.category === 'clinic' ? 'General Medicine & Primary Care' : 'Hair & Grooming',
              isAvailable: true,
            },
          ]

    const BUFFER_MINS = 15

    return rawStaff.map((member) => {
      const staffKey = (member.name || '').toLowerCase().trim()
      // All users in queue assigned to this staff member
      const staffUsers = activeUsers.filter(
        (u) => (u.assignedStaff?.name || '').toLowerCase().trim() === staffKey
      )
      const servingUser = staffUsers.find((u) => u.status === 'serving')
      const waitingUsers = staffUsers.filter((u) => u.status === 'waiting')
      const isServing = Boolean(servingUser)

      let nextSlotTimeStr = 'Immediate'
      let waitMins = 0

      if (isServing && servingUser) {
        let headStartMs = servingUser.estimatedStartTime
          ? new Date(servingUser.estimatedStartTime).getTime()
          : servingUser.joinedAt
          ? new Date(servingUser.joinedAt).getTime()
          : Date.now()

        let runningFinishMs =
          headStartMs + (Number(servingUser.serviceTime) || biz.averageServiceTime || 15) * 60000

        for (let i = 0; i < waitingUsers.length; i++) {
          const u = waitingUsers[i]
          const uStartMs = Math.max(Date.now(), runningFinishMs + BUFFER_MINS * 60000)
          const uDurationMs = (Number(u.serviceTime) || biz.averageServiceTime || 15) * 60000
          runningFinishMs = uStartMs + uDurationMs
        }

        const effectiveFinishMs = Math.max(Date.now(), runningFinishMs)
        const nextSlotMs = effectiveFinishMs + BUFFER_MINS * 60000
        waitMins = Math.max(1, Math.round((nextSlotMs - Date.now()) / 60000))
        nextSlotTimeStr = new Date(nextSlotMs).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      }

      let rushStatus = 'ready' // 'ready' | 'short' | 'moderate' | 'high'
      let rushLabel = 'Ready Now (0 in line)'
      let rushBadgeClass = 'text-emerald-700 bg-emerald-50 border-emerald-200'

      if (isServing) {
        if (waitingUsers.length >= 3) {
          rushStatus = 'high'
          rushLabel = `High Rush (${waitingUsers.length} waiting)`
          rushBadgeClass = 'text-rose-700 bg-rose-50 border-rose-200'
        } else if (waitingUsers.length >= 1) {
          rushStatus = 'moderate'
          rushLabel = `Moderate Rush (${waitingUsers.length} waiting)`
          rushBadgeClass = 'text-amber-700 bg-amber-50 border-amber-200'
        } else {
          rushStatus = 'short'
          rushLabel = 'Serving Now (0 waiting)'
          rushBadgeClass = 'text-blue-700 bg-blue-50 border-blue-200'
        }
      }

      return {
        member,
        staffKey,
        staffUsers,
        servingUser,
        waitingUsers,
        totalCount: staffUsers.length,
        isServing,
        nextSlotTimeStr,
        waitMins,
        rushStatus,
        rushLabel,
        rushBadgeClass,
      }
    })
  }, [])

  // Helper to render Business Card matching the exact design with real-time data & selection
  const renderBusinessCard = (biz, defaultImg) => {
    const isUserInQueue = myActiveQueues.some((q) => q.business._id === biz._id)
    const userQInfo = myActiveQueues.find((q) => q.business._id === biz._id)
    const activeUsers = biz.activeQueue || []

    // Per-staff real-time rush breakdown
    const staffBreakdown = getStaffQueueBreakdown(biz)
    const selectedStaffVal = selectedStaff[biz._id] || 'any'
    const curStaffName =
      typeof selectedStaffVal === 'string'
        ? selectedStaffVal
        : selectedStaffVal?.name || 'any'

    const selectedStaffStats = staffBreakdown.find(
      (s) => s.staffKey === curStaffName.toLowerCase().trim()
    )

    // Real-time Queue Status:
    const servingUser = activeUsers.find((u) => u.status === 'serving')
    const servingTokenNum = servingUser
      ? String(activeUsers.indexOf(servingUser) + 1).padStart(2, '0')
      : null
    const waitingCount = activeUsers.filter((u) => u.status === 'waiting').length

    // Compute exact synced finish time of the queue + 15 min buffer:
    const BUFFER_MINS = 15
    let nextSlotTimeStr = null
    let estWaitMins = 0

    if (activeUsers.length > 0) {
      const serving = servingUser || activeUsers[0]
      let headStartMs = serving.estimatedStartTime
        ? new Date(serving.estimatedStartTime).getTime()
        : serving.joinedAt
        ? new Date(serving.joinedAt).getTime()
        : Date.now()

      let runningFinishMs =
        headStartMs + (Number(serving.serviceTime) || biz.averageServiceTime || 15) * 60000

      // Chain waiting users: each user's slot has the service time + 15m buffer
      for (let i = 1; i < activeUsers.length; i++) {
        const u = activeUsers[i]
        const uStartMs = Math.max(Date.now(), runningFinishMs + BUFFER_MINS * 60000)
        const uDurationMs = (Number(u.serviceTime) || biz.averageServiceTime || 15) * 60000
        runningFinishMs = uStartMs + uDurationMs
      }

      // Ensure running finish time is at least current time
      const effectiveFinishMs = Math.max(Date.now(), runningFinishMs)

      // The next live queue slot for a new customer begins at finish time + 15m buffer
      const nextSlotMs = effectiveFinishMs + BUFFER_MINS * 60000
      const nextSlotDate = new Date(nextSlotMs)
      nextSlotTimeStr = nextSlotDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })

      // Wait time from now until the new customer's turn begins:
      estWaitMins = Math.max(1, Math.round((nextSlotMs - Date.now()) / 60000))
    }

    const photoUrl =
      biz.coverImage ||
      biz.logo ||
      (biz.category === 'clinic' ? defaultImg || DEFAULT_CLINIC_IMAGES[0] : defaultImg || DEFAULT_SALON_IMAGES[0])

    const distanceDisplay = biz.distance ? `${biz.distance.toFixed(1)} km` : '1.2 km'
    const avgRating = biz.averageRating || 4.8
    const reviewCount = biz.reviewCount || 320
    const servicesList = biz.services?.length
      ? biz.services
      : [{ name: 'General Consultation', duration: 15, price: 400 }]

    // Active chosen services for this card
    const curChosenServices =
      selectedServices[biz._id] && selectedServices[biz._id].length > 0
        ? selectedServices[biz._id]
        : servicesList.length > 0
        ? [servicesList[0]]
        : []

    const chosenDuration = curChosenServices.reduce((sum, s) => sum + (Number(s.duration) || 15), 0)
    const totalPrice = curChosenServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0)

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

          {/* 3-Column Real-Time Live Queue Panel */}
          <div className="bg-[#F4F8F5] border border-[#E3EDE5] rounded-2xl p-2.5 grid grid-cols-3 text-center divide-x divide-[#E0EBE2]">
            <div className="px-1">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Now Serving</p>
              <p className="text-sm sm:text-base font-black text-[#114227] mt-0.5">
                {servingTokenNum ? `#${servingTokenNum}` : '--'}
              </p>
              <p className="text-[9px] text-zinc-400 font-medium">
                {servingUser ? 'In Consultation' : 'Available'}
              </p>
            </div>
            <div className="px-1">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Waiting</p>
              <p className="text-xs sm:text-sm font-bold text-zinc-800 mt-0.5">
                {activeUsers.length} <span className="text-[10px] text-zinc-500 font-normal">in line</span>
              </p>
              <p className="text-[9px] text-zinc-400 font-medium">
                {activeUsers.length === 1 && servingUser ? '1 Serving' : `${waitingCount} waiting`}
              </p>
            </div>
            <div className="px-1">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Est. Wait</p>
              <p className="text-xs sm:text-sm font-black text-amber-700 mt-0.5">
                {nextSlotTimeStr ? `~${estWaitMins} min` : '~0 min'}
              </p>
              <p
                className="text-[9px] text-emerald-800 font-bold truncate"
                title={nextSlotTimeStr ? `Next Slot: ${nextSlotTimeStr} (+15m buffer)` : 'Queue Ready'}
              >
                {nextSlotTimeStr ? `Next: ${nextSlotTimeStr}` : 'Queue Ready'}
              </p>
            </div>
          </div>

          {/* View Live Queue Redirect Button */}
          <button
            type="button"
            onClick={() => navigate(`/queue/${biz._id}`)}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-200/90 text-emerald-900 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer group/rush shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-emerald-700" />
              <span>View Live Queue</span>
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 group-hover/rush:translate-x-0.5 transition-transform">
              <span>Queue Page</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>

          {/* Next Available Slot Notification Banner when busy */}
          {nextSlotTimeStr && (
            <div className="bg-[#EBF7EE] border border-[#CDEBD4] rounded-xl px-3 py-1.5 flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#114227] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Next Live Slot:</span>
              </span>
              <span className="font-black text-[#114227]">
                {nextSlotTimeStr} <span className="text-[9px] text-zinc-500 font-medium">(+15m buffer)</span>
              </span>
            </div>
          )}

          {/* Interactive Service Selector Pills */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold">
              <span>Choose Services:</span>
              {totalPrice > 0 && (
                <span className="text-[#114227] font-bold">
                  ₹{totalPrice} • {chosenDuration} min
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {servicesList.map((s, idx) => {
                const isSelected = curChosenServices.some((cs) => cs.name === s.name)
                return (
                  <button
                    key={s._id || idx}
                    type="button"
                    onClick={() => handleToggleService(biz._id, s)}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#EAF5EC] text-[#114227] border border-[#16A34A] shadow-xs'
                        : 'bg-zinc-100/90 hover:bg-zinc-200/80 text-zinc-700 border border-zinc-200/70'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-2.5 h-2.5 text-[#114227]" />
                    ) : (
                      <User className="w-2.5 h-2.5 text-zinc-400" />
                    )}
                    <span className="line-clamp-1">{s.name}</span>
                    {s.price !== undefined && s.price > 0 && (
                      <span className={`text-[9px] font-bold ${isSelected ? 'text-[#16A34A]' : 'text-zinc-500'}`}>
                        ₹{s.price}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Specialist / Staff Selector with Live Rush Status */}
          {biz.staff && biz.staff.length > 0 && (
            <div className="pt-2 border-t border-zinc-100/80 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-zinc-500 shrink-0 flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-400" />
                  <span>{biz.category === 'clinic' ? 'Doctor:' : 'Specialist:'}</span>
                </span>
                <div className="relative flex-1 max-w-[210px]">
                  <select
                    value={curStaffName}
                    onChange={(e) => {
                      const chosenName = e.target.value
                      const found = biz.staff.find((st) => st.name === chosenName)
                      setSelectedStaff((prev) => ({
                        ...prev,
                        [biz._id]: found || 'any',
                      }))
                    }}
                    className="w-full text-[11px] font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/90 rounded-xl pl-2.5 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer appearance-none truncate"
                  >
                    <option value="any">Any Available (Fastest Turn • Lowest Rush)</option>
                    {staffBreakdown.map((s) => (
                      <option key={s.member._id || s.member.name} value={s.member.name}>
                        {s.member.name} — {s.isServing ? `Busy (${s.waitingUsers.length} waiting • Next ${s.nextSlotTimeStr})` : 'Ready Now (0 in line)'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-zinc-400 absolute right-2.5 top-2 pointer-events-none" />
                </div>
              </div>

              {/* Personal queue live status badge for selected staff */}
              <div className="text-[10px] rounded-xl px-2.5 py-1.5 border border-zinc-200/80 bg-zinc-50/70">
                {curStaffName === 'any' ? (
                  <div className="flex items-center gap-1.5 text-zinc-600 font-medium">
                    <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Auto-assigns doctor with zero rush or fastest available turn.</span>
                  </div>
                ) : selectedStaffStats?.isServing ? (
                  <div className="flex items-center justify-between gap-1 text-amber-900">
                    <span className="flex items-center gap-1.5 font-bold truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                      <span>{curStaffName} is serving</span>
                      <span className="text-zinc-500 font-normal">({selectedStaffStats.waitingUsers.length} ahead in their queue)</span>
                    </span>
                    <span className="font-black shrink-0 text-amber-800 bg-amber-100/70 border border-amber-200 px-1.5 py-0.5 rounded text-[9px]">
                      Slot: ~{selectedStaffStats.nextSlotTimeStr}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>{curStaffName} is Free Now! You will be served immediately.</span>
                  </div>
                )}
              </div>
            </div>
          )}

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
              onClick={() => {
                navigate(`/booking/${biz._id}`, {
                  state: {
                    selectedServices: curChosenServices,
                    selectedStaff: selectedStaff[biz._id],
                  },
                })
              }}
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
          <Link to="/" className="flex items-center group text-decoration-none">
            <img src="/serveq-logo.png" alt="serveQ" className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105" />
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
                    else if (item.id === 'my-queues') {
                      if (myActiveQueues.length > 0 && myActiveQueues[0].business?._id) {
                        navigate(`/queue/${myActiveQueues[0].business._id}`)
                      } else if (businesses.length > 0) {
                        navigate(`/queue/${businesses[0]._id}`)
                      } else {
                        navigate('/queue')
                      }
                    } else if (item.id === 'appointments') {
                      const upcomingBooking = myBookings.find(
                        (b) => b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'refunded'
                      )
                      const targetBizId =
                        upcomingBooking?.businessId?._id ||
                        upcomingBooking?.businessId ||
                        businesses[0]?._id
                      if (targetBizId) {
                        navigate(`/booking/${targetBizId}`)
                      } else {
                        navigate('/booking')
                      }
                    } else if (item.id === 'history') {
                      navigate('/history')
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
              onClick={() => navigate('/support')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
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
    </div>
  )
}
