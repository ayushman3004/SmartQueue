import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getAllBusinesses } from '../api/business.api'
import { joinQueue, leaveQueue } from '../api/queue.api'
import { getMyBookings, cancelBooking } from '../api/booking.api'
import { getAvailableCoupons } from '../api/coupon.api'
import { submitReview } from '../api/review.api'
import { CATEGORY_METADATA } from '../utils/servicePresets'
import { toast } from 'react-hot-toast'
import { useSeo } from '../utils/useSeo'
import { useDebounce } from '../hooks/useDebounce'

const CATEGORIES = [
  { id: 'all', label: 'All Hubs' },
  { id: 'salon', label: 'Salons & Hair Studios' },
  { id: 'clinic', label: 'Clinics & Doctors' },
]

export default function CustomerDashboardPage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const { onBusinessStatus, socket } = useSocket()

  useSeo({
    title: 'Customer Dashboard & Queues',
    description: 'Explore live venues, join virtual waiting queues, and manage your appointments.',
    robots: 'noindex, nofollow',
  })

  const [businesses, setBusinesses] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [joiningBizId, setJoiningBizId] = useState(null)
  const [leavingBizId, setLeavingBizId] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [historyFilter, setHistoryFilter] = useState('all') // 'all' | 'completed' | 'upcoming'

  const debouncedSearch = useDebounce(search, 350)
  const debouncedLocation = useDebounce(locationQuery, 350)

  // Selected services per business (for inline live join)
  // map: { [businessId]: serviceObj[] }
  const [selectedServices, setSelectedServices] = useState({})
  // Selected staff per business (for inline live join)
  // map: { [businessId]: 'any' | staffObj }
  const [selectedStaff, setSelectedStaff] = useState({})

  // Toggle service selection for a business
  const handleToggleService = (bizId, svc, allServices) => {
    setSelectedServices(prev => {
      const current = prev[bizId] || (allServices?.length > 0 ? [allServices[0]] : [svc])
      const exists = current.some(s => s.name === svc.name)
      if (exists) {
        if (current.length === 1) {
          toast('At least one service must remain selected', { icon: 'ℹ️' })
          return prev
        }
        return {
          ...prev,
          [bizId]: current.filter(s => s.name !== svc.name),
        }
      } else {
        return {
          ...prev,
          [bizId]: [...current, svc],
        }
      }
    })
  }

  // Coupon Drawer
  const [showCoupons, setShowCoupons] = useState(false)

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBookingForReview, setSelectedBookingForReview] = useState(null)
  const [rating, setRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Fetch initial dashboard data
  const fetchData = useCallback(async () => {
    try {
      const [allRes, myBkRes, coupRes] = await Promise.all([
        getAllBusinesses({ search: debouncedSearch, category: selectedCategory, location: debouncedLocation, includeAll: false }),
        getMyBookings().catch(() => ({ data: { data: { bookings: [] } } })),
        getAvailableCoupons().catch(() => ({ data: { data: { coupons: [] } } })),
      ])

      const bizList = allRes.data.data.businesses || []
      setBusinesses(bizList)
      setMyBookings(myBkRes.data.data.bookings || [])
      setCoupons(coupRes.data.data.coupons || [])

      // Initialize default selected services and staff for each business
      setSelectedServices(prev => {
        const next = { ...prev }
        bizList.forEach(b => {
          if (!next[b._id]) {
            next[b._id] = b.services?.length ? [b.services[0]] : [{ name: 'General Service', duration: b.averageServiceTime || 15, price: b.basePrice || 0 }]
          }
        })
        return next
      })

      setSelectedStaff(prev => {
        const next = { ...prev }
        bizList.forEach(b => {
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
  }, [debouncedSearch, selectedCategory, debouncedLocation])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time socket listeners for queues and status changes
  useEffect(() => {
    if (!socket) return

    const unsubStatus = onBusinessStatus?.((data) => {
      setBusinesses(prev =>
        prev.map(b => (b._id === data.businessId ? { ...b, isOpen: data.isOpen, isActive: data.isActive } : b))
      )
    })

    const handleQueueChange = (updatedQueue) => {
      if (!updatedQueue) return
      const targetBizId = updatedQueue.businessId?._id || updatedQueue.businessId

      setBusinesses(prev =>
        prev.map(b => {
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
      getMyBookings().then(myBkRes => setMyBookings(myBkRes.data?.data?.bookings || [])).catch(() => {})
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

    businesses.forEach(biz => {
      const qUsers = biz.activeQueue || []
      const foundIdx = qUsers.findIndex(u => {
        const uId = (u.userId?._id || u.userId)?.toString()
        return uId === myIdStr
      })

      if (foundIdx !== -1) {
        const myItem = qUsers[foundIdx]
        const position = foundIdx + 1
        const peopleAhead = Math.max(0, foundIdx)
        const servingItem = qUsers.find(u => u.status === 'serving')

        active.push({
          business: biz,
          myQueueItem: myItem,
          position,
          peopleAhead,
          totalInQueue: qUsers.length,
          isServing: myItem.status === 'serving',
          servingToken: servingItem ? qUsers.indexOf(servingItem) + 1 : null,
          estimatedStartTime: myItem.estimatedStartTime,
        })
      }
    })

    return active
  }, [businesses, user?._id])

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
    const curServices = selectedServices[biz._id] || (services.length > 0 ? [services[0]] : [{ name: 'General Service', duration: biz.averageServiceTime || 15, price: biz.basePrice || 0 }])
    const curStaff = selectedStaff[biz._id] || 'any'
    const preferredStaffName = curStaff === 'any' ? null : (typeof curStaff === 'string' ? curStaff : curStaff.name)
    const paymentMethod = biz.paymentConfiguration?.paymentMode === 'ONLINE' ? 'WALLET' : 'PAY_AT_BUSINESS'

    setJoiningBizId(biz._id)

    try {
      const res = await joinQueue(biz._id, {
        services: curServices,
        serviceType: curServices.map(s => s.name).join(', '),
        preferredStaff: preferredStaffName,
        paymentMethod,
      })
      const updatedQ = res.data.data.queue

      // Update business local state immediately
      setBusinesses(prev =>
        prev.map(b => (b._id === biz._id ? { ...b, activeQueue: updatedQ.users, queueLength: updatedQ.users.length } : b))
      )

      // Refresh customer appointment bookings & history immediately
      getMyBookings().then(myBkRes => setMyBookings(myBkRes.data?.data?.bookings || [])).catch(() => {})

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

      setBusinesses(prev =>
        prev.map(b => (b._id === bizId ? { ...b, activeQueue: updatedQ.users, queueLength: updatedQ.users.length } : b))
      )

      // Refresh customer appointment bookings & history immediately
      getMyBookings().then(myBkRes => setMyBookings(myBkRes.data?.data?.bookings || [])).catch(() => {})

      toast.success(`Left queue at ${bizName}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not leave queue')
    } finally {
      setLeavingBizId(null)
    }
  }

  // Cancel Appointment Booking
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Cancel this appointment? Pre-paid amounts will be refunded to your wallet.')) return
    try {
      const res = await cancelBooking(bookingId)
      toast.success(res.data.message || 'Booking cancelled and refunded')
      getMyBookings().then(r => setMyBookings(r.data.data.bookings || []))
      if (res.data.data?.refunded) {
        setUser(prev => prev ? { ...prev, walletBalance: (prev.walletBalance || 0) + res.data.data.refunded } : prev)
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
      getMyBookings().then(r => setMyBookings(r.data.data.bookings || []))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  return (
    <div className="container max-w-7xl pt-4 pb-24 space-y-10 px-4 sm:px-6 text-left">
      {/* ── Top Header & User Welcome Banner ── */}
      <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-teal-950 p-6 sm:p-8 md:p-10 rounded-3xl text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-zinc-800">
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-teal-500/10 rounded-full blur-[110px] pointer-events-none" />

        <div className="space-y-3 z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>Customer Operations Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none text-white">
            Welcome, {user?.name?.split(' ')[0] || 'Customer'}
          </h1>
          <p className="text-zinc-300 text-xs sm:text-sm font-medium leading-relaxed max-w-lg">
            Track present queues live, join queues with one click, and arrive just in time without waiting in physical lines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10">
          <button
            onClick={() => navigate('/wallet')}
            className="flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/20 px-4 py-2.5 rounded-2xl backdrop-blur-md transition-all active:scale-[0.98] shadow-sm"
          >
            <span className="w-8 h-8 rounded-xl bg-teal-500/30 flex items-center justify-center text-xs font-black text-white">₹</span>
            <div className="text-left">
              <p className="text-[9px] uppercase font-black text-teal-300 tracking-wider leading-none">Wallet</p>
              <p className="text-sm font-black text-white mt-0.5">₹{(user?.walletBalance ?? 0).toLocaleString()}</p>
            </div>
          </button>

          <button
            onClick={() => setShowCoupons(!showCoupons)}
            className="px-4.5 py-2.5 rounded-2xl bg-teal-400 hover:bg-teal-300 text-zinc-950 font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-2"
          >
            <span>Coupons ({coupons.length})</span>
          </button>
        </div>
      </div>

      {/* ── Active Express Coupons Drawer ── */}
      <AnimatePresence>
        {showCoupons && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border border-teal-200/90 rounded-3xl p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-xs font-black text-zinc-950 uppercase tracking-widest flex items-center gap-2">
                Active Express Coupons
              </h3>
              <button
                onClick={() => setShowCoupons(false)}
                className="text-xs text-zinc-400 hover:text-zinc-900 font-bold px-2 py-1 rounded-md hover:bg-zinc-100"
              >
                Close ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {coupons.map((c, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-[11px] font-black text-teal-900 bg-teal-200/80 px-2 py-0.5 rounded-md tracking-wider">{c.code}</span>
                    <p className="text-xs text-zinc-600 mt-1 font-medium">{c.description || `Save ₹${c.amount} on checkout`}</p>
                  </div>
                  <span className="text-base font-black text-teal-700">₹{c.amount} OFF</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SECTION 1: MY ACTIVE LIVE QUEUES & TICKETS ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2.5">
              <span>My Active Queue Tickets</span>
              {myActiveQueues.length > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-teal-100 text-teal-800">
                  {myActiveQueues.length} Active
                </span>
              )}
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Live updates for queues you are currently in. Your token updates as other patrons are served.
            </p>
          </div>
        </div>

        {myActiveQueues.length === 0 ? (
          <div className="bg-white border border-dashed border-zinc-300 rounded-3xl p-8 sm:p-10 text-center space-y-2">
            <p className="text-sm font-black text-zinc-800">You are not in any live queues right now.</p>
            <p className="text-xs text-zinc-400 font-medium max-w-md mx-auto">
              Select any open salon or clinic below to grab your live token. You can wait anywhere and walk in when called!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myActiveQueues.map(({ business, myQueueItem, position, peopleAhead, totalInQueue: _totalInQueue, isServing, servingToken, estimatedStartTime }) => (
              <div
                key={business._id}
                className={`p-6 rounded-3xl border shadow-sm transition-all flex flex-col justify-between gap-5 ${
                  isServing
                    ? 'bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-emerald-300 ring-2 ring-emerald-400/40'
                    : 'bg-white border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-zinc-950 tracking-tight">{business.name}</h3>
                      </div>
                      <p className="text-xs text-zinc-500 font-medium mt-0.5">{business.address || business.location}</p>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isServing
                        ? 'bg-emerald-600 text-white animate-pulse shadow-sm'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}>
                      {isServing ? 'NOW SERVING' : 'WAITING IN LINE'}
                    </span>
                  </div>

                  {/* Token & Progress Grid */}
                  <div className="grid grid-cols-3 gap-3 my-4 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/70 text-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-zinc-400">Your Token</p>
                      <p className="text-2xl font-black text-teal-800 mt-0.5">#{position}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-zinc-400">Ahead of You</p>
                      <p className="text-2xl font-black text-zinc-900 mt-0.5">
                        {isServing ? '0' : peopleAhead}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-zinc-400">Now Serving</p>
                      <p className="text-2xl font-black text-indigo-700 mt-0.5">
                        {servingToken ? `#${servingToken}` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Service info & Est start */}
                  <div className="text-xs text-zinc-600 space-y-1.5">
                    <p>
                      Service: <strong className="text-zinc-950">{myQueueItem.serviceType || 'General Service'}</strong>
                    </p>
                    {myQueueItem.services && myQueueItem.services.length > 1 && (
                      <div className="flex flex-wrap gap-1">
                        {myQueueItem.services.map((s, idx) => (
                          <span key={idx} className="text-[10px] font-bold bg-teal-50 border border-teal-200 text-teal-800 px-2 py-0.5 rounded-md">
                            {s.name} ({s.duration}m • ₹{s.price})
                          </span>
                        ))}
                      </div>
                    )}
                    {myQueueItem.assignedStaff?.name && (
                      <p className="flex items-center gap-1.5 text-xs">
                        <span className="text-zinc-500 font-medium">
                          {business.category === 'clinic' ? 'Doctor:' : 'Barber:'}
                        </span>
                        <span className="font-bold text-zinc-950 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md text-[11px] inline-flex items-center gap-1">
                          {myQueueItem.assignedStaff.name}
                          {myQueueItem.assignedStaff.autoAssigned && (
                            <span className="text-[9px] text-teal-700 font-semibold">(On-Duty Fallback)</span>
                          )}
                        </span>
                      </p>
                    )}
                    {estimatedStartTime && !isServing && (
                      <p className="text-teal-700 font-semibold">
                        Est. Start: {new Date(estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-zinc-100">
                  <button
                    onClick={() => navigate(`/queue/${business._id}`)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5"
                  >
                    <span>View Live Screen</span>
                  </button>
                  <button
                    onClick={() => handleLeaveQueue(business._id, business.name)}
                    disabled={leavingBizId === business._id}
                    className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {leavingBizId === business._id ? 'Leaving...' : 'Leave Queue'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── SECTION 2: PRESENT QUEUES AT NEARBY HUBS (SALONS & CLINICS) ── */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
              <span>Present Live Queues at Nearby Hubs</span>
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Browse current waiting queues, view tokens being served, and join the line directly from your phone.
            </p>
          </div>

          {/* Search & Location Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search salon, clinic, doctor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium w-48 sm:w-56"
            />
            <input
              type="text"
              placeholder="Location..."
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium w-28 sm:w-32"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                selectedCategory === cat.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Present Queues Grid */}
        {loading ? (
          <div className="p-16 text-center">
            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Syncing live queues...</p>
          </div>
        ) : businesses.length === 0 ? (
          <div className="p-16 text-center border border-dashed border-zinc-300 rounded-3xl bg-white space-y-2">
            <p className="text-sm font-black text-zinc-800">No active businesses found</p>
            <p className="text-xs text-zinc-400">Try adjusting your category filter or search keywords.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {businesses.map((biz) => {
              const qUsers = biz.activeQueue || []
              const servingUser = qUsers.find(u => u.status === 'serving')
              const servingToken = servingUser ? qUsers.indexOf(servingUser) + 1 : null
              const isUserInQueue = user?._id && qUsers.some(u => (u.userId?._id || u.userId)?.toString() === user._id.toString())
              const userTokenIndex = user?._id ? qUsers.findIndex(u => (u.userId?._id || u.userId)?.toString() === user._id.toString()) : -1

              const services = biz.services || []
              const isClinic = biz.category === 'clinic' || biz.category === 'healthcare'
              const staffRoleLabel = isClinic ? 'Doctor' : 'Barber'
              const staffList = biz.staff || []

              // Compute staff members currently in service taking service from patrons
              const busyStaffNames = new Set(
                qUsers
                  .filter(u => u.status === 'serving' && u.assignedStaff?.name)
                  .map(u => u.assignedStaff.name.toLowerCase())
              )
              staffList.forEach(st => {
                if (st.isOccupied) busyStaffNames.add(st.name.toLowerCase())
              })

              const curSelectedServices = selectedServices[biz._id] || (services.length > 0 ? [services[0]] : [{ name: 'General Service', duration: biz.averageServiceTime || 15, price: biz.basePrice || 0 }])
              const totalDuration = curSelectedServices.reduce((acc, s) => acc + (s.duration || 15), 0)
              const totalPrice = curSelectedServices.reduce((acc, s) => acc + (s.price ?? biz.basePrice ?? 0), 0)
              const curStaff = selectedStaff[biz._id] || 'any'
              const curStaffName = typeof curStaff === 'string' ? curStaff : curStaff?.name
              const isCurStaffOccupied = curStaffName && curStaffName !== 'any' && busyStaffNames.has(curStaffName.toLowerCase())

              return (
                <div
                  key={biz._id}
                  className="bg-white border border-zinc-200 hover:border-zinc-300 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5"
                >
                  <div>
                    {/* Header: Title, Category & Open Badge */}
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-zinc-950 tracking-tight">{biz.name}</h3>
                        </div>
                        <p className="text-xs text-zinc-500 font-medium mt-0.5 line-clamp-1">{biz.address || biz.location || 'Local Venue'}</p>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex-shrink-0 ${
                        biz.isOpen
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-700 border border-rose-200'
                      }`}>
                        {biz.isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                    </div>

                    {/* LIVE PRESENT QUEUE METRICS BOX */}
                    <div className="grid grid-cols-3 gap-2 my-4 p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-center">
                      <div className="p-1">
                        <p className="text-[9px] uppercase font-black text-zinc-400 tracking-wider">Now Serving</p>
                        <p className="text-base font-black text-indigo-700 mt-0.5">
                          {servingToken ? `#${servingToken}` : 'Idle'}
                        </p>
                      </div>
                      <div className="p-1 border-x border-zinc-200">
                        <p className="text-[9px] uppercase font-black text-zinc-400 tracking-wider">Waiting</p>
                        <p className="text-base font-black text-zinc-900 mt-0.5">
                          {biz.queueLength ?? qUsers.length} <span className="text-[10px] text-zinc-400 font-normal">in line</span>
                        </p>
                      </div>
                      <div className="p-1">
                        <p className="text-[9px] uppercase font-black text-zinc-400 tracking-wider">Est. Wait</p>
                        <p className="text-base font-black text-teal-800 mt-0.5">
                          ~{biz.estimatedWait ?? 0}m
                        </p>
                      </div>
                    </div>

                    {/* Multi-Service Selection */}
                    <div className="space-y-2 mt-3 pt-3 border-t border-zinc-100">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                          Select Services (Choose Multiple)
                        </p>
                        <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                          {curSelectedServices.length} Selected • {totalDuration}m
                        </span>
                      </div>

                      {services.length > 0 ? (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                          {services.map((svc, sIdx) => {
                            const isSelected = curSelectedServices.some(s => s.name === svc.name)
                            return (
                              <div
                                key={sIdx}
                                onClick={() => handleToggleService(biz._id, svc, services)}
                                className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between select-none ${
                                  isSelected
                                    ? 'bg-teal-50/80 border-teal-500 font-semibold ring-1 ring-teal-500/20 text-zinc-950 shadow-xs'
                                    : 'bg-zinc-50 border-zinc-200/80 text-zinc-600 hover:bg-white hover:border-zinc-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] font-black transition-colors flex-shrink-0 ${
                                    isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-zinc-300 bg-white text-transparent'
                                  }`}>
                                    ✓
                                  </div>
                                  <span className="truncate">{svc.name}</span>
                                </div>
                                <div className="flex items-center gap-2 font-bold flex-shrink-0 ml-2">
                                  <span className="text-[10px] text-zinc-400">{svc.duration}m</span>
                                  <span className="text-xs font-black text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-md">
                                    ₹{svc.price ?? biz.basePrice ?? 0}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 flex justify-between">
                          <span>General Consultation</span>
                          <span>{biz.averageServiceTime || 15}m • ₹{biz.basePrice || 0}</span>
                        </div>
                      )}
                    </div>

                    {/* Doctor / Barber Selection with Auto-Fallback */}
                    <div className="space-y-1.5 mt-3 pt-3 border-t border-zinc-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1">
                          <span>Select {staffRoleLabel}</span>
                        </label>
                        <span className="text-[9px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                          Auto-Fallback Guarantee
                        </span>
                      </div>

                      <select
                        value={typeof curStaff === 'string' ? curStaff : (curStaff?.name || 'any')}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === 'any') {
                            setSelectedStaff(prev => ({ ...prev, [biz._id]: 'any' }))
                          } else {
                            const found = staffList.find(s => s.name === val)
                            setSelectedStaff(prev => ({ ...prev, [biz._id]: found || val }))
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-semibold bg-white text-zinc-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="any">Any Available {isClinic ? 'General Physician / Doctor' : 'Barber / Stylist'} (Auto-Assign On-Duty)</option>
                        {staffList.map((st, stIdx) => {
                          const isOccupied = busyStaffNames.has(st.name.toLowerCase())
                          const isAvailable = (st.isAvailable !== false) && !isOccupied
                          return (
                            <option key={stIdx} value={st.name} disabled={!isAvailable}>
                              {isOccupied ? '[In Service]' : isAvailable ? '[Available]' : '[Off-Duty]'} {st.name} — {st.role || (isClinic ? 'Doctor' : 'Stylist')} {st.specialties ? `(${st.specialties})` : ''} {isOccupied ? '• IN SERVICE (NOT AVAILABLE)' : (st.isAvailable === false ? '• Off-Duty' : '• Available')}
                            </option>
                          )
                        })}
                      </select>

                      {/* Live busy notice if any staff are currently taking service */}
                      {staffList.some(s => busyStaffNames.has(s.name.toLowerCase())) && (
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-[10px] text-rose-900 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
                          <span>
                            {staffList.filter(s => busyStaffNames.has(s.name.toLowerCase())).map(s => s.name).join(', ')} currently in service with a patron. Unavailable until service completes.
                          </span>
                        </div>
                      )}

                      {/* Selected staff is occupied alert */}
                      {isCurStaffOccupied && (
                        <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 text-[10px] text-amber-900 font-medium flex items-center gap-1.5">
                          <span className="font-bold text-amber-600">!</span>
                          <span>
                            <strong>{curStaffName}</strong> is in service now. Auto-fallback will pair you with {isClinic ? 'an on-duty General Physician' : 'an available on-duty Barber'}.
                          </span>
                        </div>
                      )}

                      <p className="text-[10px] text-zinc-400 leading-tight">
                        {isClinic
                          ? 'If chosen doctor is unavailable or in service, auto-assigned to on-duty General Physician.'
                          : 'If chosen barber is unavailable or in service, auto-assigned to any available on-duty barber.'}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="space-y-2 pt-2 border-t border-zinc-100">
                    {isUserInQueue ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/queue/${biz._id}`)}
                          className="flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <span>In Line (Token #{userTokenIndex + 1})</span>
                        </button>
                        <button
                          onClick={() => handleLeaveQueue(biz._id, biz.name)}
                          disabled={leavingBizId === biz._id}
                          className="py-3 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all"
                          title="Leave Queue"
                        >
                          ✕
                        </button>
                      </div>
                    ) : biz.queueSettings?.enableLiveQueue === false ? (
                      <div className="w-full py-2.5 px-3 rounded-xl bg-zinc-100 text-zinc-400 font-bold text-xs text-center border border-zinc-200">
                        Live Queue Currently Unavailable
                      </div>
                    ) : (
                      <button
                        onClick={() => handleJoinQueue(biz)}
                        disabled={!biz.isOpen || joiningBizId === biz._id}
                        className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-black text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 active:scale-98"
                      >
                        {joiningBizId === biz._id ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Joining Live Queue...</span>
                          </>
                        ) : (
                          <>
                            <span>Join Live Queue</span>
                            <span className="text-[10px] opacity-80">(~{totalDuration}m • ₹{totalPrice})</span>
                          </>
                        )}
                      </button>
                    )}

                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => navigate(`/queue/${biz._id}`)}
                        className="flex-1 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold transition-colors text-center text-[11px]"
                      >
                        View Queue Screen
                      </button>
                      {biz.bookingSettings?.enableAppointments === false ? (
                        <span className="flex-1 py-2 rounded-xl bg-zinc-50 text-zinc-400 font-bold transition-colors text-center text-[11px] cursor-not-allowed">
                          Walk-in Only
                        </span>
                      ) : (
                        <button
                          onClick={() => navigate(`/booking/${biz._id}`)}
                          className="flex-1 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold transition-colors text-center text-[11px]"
                        >
                          Book Time Slot
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── SECTION 3: SERVICE HISTORY & APPOINTMENT BOOKINGS ── */}
      <section className="space-y-4 pt-4 border-t border-zinc-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
              <span>Service History & Appointments</span>
            </h2>
            <p className="text-xs text-zinc-500 font-medium">Complete history of services taken across all clinics, salons & hubs, with rating options.</p>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-zinc-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setHistoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${historyFilter === 'all' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              All ({myBookings.length})
            </button>
            <button
              onClick={() => setHistoryFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all ${historyFilter === 'completed' ? 'bg-white text-emerald-800 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              Completed ({myBookings.filter(b => b.status === 'completed').length})
            </button>
            <button
              onClick={() => setHistoryFilter('upcoming')}
              className={`px-3 py-1.5 rounded-lg transition-all ${historyFilter === 'upcoming' ? 'bg-white text-teal-800 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              Upcoming ({myBookings.filter(b => b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'refunded').length})
            </button>
          </div>
        </div>

        {myBookings.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-2xl bg-white">
            No service history or appointment bookings on record yet. Completed services will appear here with rating options.
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-3xl border border-zinc-200 shadow-sm">
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
                {myBookings
                  .filter((b) => {
                    if (historyFilter === 'completed') return b.status === 'completed';
                    if (historyFilter === 'upcoming') return b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'refunded';
                    return true;
                  })
                  .map((b) => (
                  <tr key={b._id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-4 px-4 font-bold text-zinc-950">
                      {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <p className="text-[10px] text-zinc-400 font-normal">{new Date(b.startTime).toLocaleDateString()}</p>
                    </td>
                    <td className="py-4 px-4 font-bold text-zinc-900">
                      {b.businessId?.name || 'Local Venue'}
                    </td>
                    <td className="py-4 px-4 text-zinc-700">
                      <p className="font-semibold text-zinc-950">{b.serviceType}</p>
                      {b.assignedStaff?.name && (
                        <p className="text-[11px] font-bold text-teal-800 flex items-center gap-1 mt-0.5">
                          <span>{b.assignedStaff.name}</span>
                          <span className="text-[10px] text-zinc-400 font-normal">({b.assignedStaff.role || 'On-Duty'})</span>
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-4 font-bold text-teal-700">₹{b.paidAmount}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        b.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : b.status === 'serving'
                          ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                          : b.status === 'cancelled'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-teal-100 text-teal-800'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      {b.status === 'completed' && (
                        b.review ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-xl text-xs font-bold">
                            <span className="text-amber-500 font-black">{b.review.rating} ★</span>
                            <span className="text-[10px] text-amber-700 font-semibold">Rated</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenReview(b)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-xs transition-transform active:scale-95 inline-flex items-center gap-1"
                          >
                            <span>★ Rate Service</span>
                          </button>
                        )
                      )}
                      {(b.status === 'scheduled' || b.status === 'confirmed' || b.status === 'waiting') && (
                        <button
                          onClick={() => handleCancelBooking(b._id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px]"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Review Modal ── */}
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
                        className={`text-2xl transition-transform hover:scale-110 ${star <= rating ? 'text-amber-400' : 'text-zinc-200'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Comments</label>
                  <textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Describe your turnaround time, stylist skill, or doctor care..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-5 py-2 text-xs font-black uppercase tracking-wider bg-teal-600 hover:bg-teal-700 text-white rounded-xl disabled:opacity-50"
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
