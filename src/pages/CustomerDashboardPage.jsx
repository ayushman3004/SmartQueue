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

const CATEGORIES = [
  { id: 'all', label: 'All Hubs', icon: '🏪' },
  { id: 'salon', label: 'Salons & Hair Studios', icon: '✂️' },
  { id: 'clinic', label: 'Clinics & Doctors', icon: '🩺' },
]

export default function CustomerDashboardPage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const { onBusinessStatus, onQueueUpdate, socket, connected } = useSocket()

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

  // Selected services per business (for inline live join)
  // map: { [businessId]: serviceName }
  const [selectedServices, setSelectedServices] = useState({})

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
        getAllBusinesses({ search, category: selectedCategory, location: locationQuery, includeAll: false }),
        getMyBookings().catch(() => ({ data: { data: { bookings: [] } } })),
        getAvailableCoupons().catch(() => ({ data: { data: { coupons: [] } } })),
      ])

      const bizList = allRes.data.data.businesses || []
      setBusinesses(bizList)
      setMyBookings(myBkRes.data.data.bookings || [])
      setCoupons(coupRes.data.data.coupons || [])

      // Initialize default selected services for each business
      setSelectedServices(prev => {
        const next = { ...prev }
        bizList.forEach(b => {
          if (!next[b._id]) {
            next[b._id] = b.services?.[0]?.name || 'General Service'
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
  }, [search, selectedCategory, locationQuery])

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

    socket.on('queue:update', handleQueueChange)
    socket.on('queue:updated', (data) => handleQueueChange(data?.queue))
    socket.on('queue:joined', (data) => handleQueueChange(data?.queue))
    socket.on('queue:left', (data) => handleQueueChange(data?.queue))

    return () => {
      unsubStatus?.()
      socket.off('queue:update', handleQueueChange)
      socket.off('queue:updated')
      socket.off('queue:joined')
      socket.off('queue:left')
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
    if (!biz.isOpen) {
      toast.error('This business is currently closed for check-ins.')
      return
    }

    const serviceName = selectedServices[biz._id] || biz.services?.[0]?.name || 'General Service'
    setJoiningBizId(biz._id)

    try {
      const res = await joinQueue(biz._id, { serviceType: serviceName })
      const updatedQ = res.data.data.queue

      // Update business local state immediately
      setBusinesses(prev =>
        prev.map(b => (b._id === biz._id ? { ...b, activeQueue: updatedQ.users, queueLength: updatedQ.users.length } : b))
      )

      toast.success(`🎉 You joined the queue at ${biz.name}!`)
    } catch (err) {
      if (err.response?.status === 400 || err.response?.data?.message?.includes('already')) {
        toast('You are already registered in this queue.', { icon: 'ℹ️' })
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
            <span className="w-8 h-8 rounded-xl bg-teal-500/30 flex items-center justify-center text-sm">💳</span>
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
            <span className="text-sm">🏷️</span>
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
                <span>🎁</span> Active Express Coupons
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
              <span>🎟️</span>
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
            <span className="text-3xl">🎫</span>
            <p className="text-sm font-black text-zinc-800">You are not in any live queues right now.</p>
            <p className="text-xs text-zinc-400 font-medium max-w-md mx-auto">
              Select any open salon or clinic below to grab your live token. You can wait anywhere and walk in when called!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myActiveQueues.map(({ business, myQueueItem, position, peopleAhead, totalInQueue, isServing, servingToken, estimatedStartTime }) => (
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
                        <span className="text-base">{business.category === 'salon' ? '✂️' : '🩺'}</span>
                        <h3 className="text-lg font-black text-zinc-950 tracking-tight">{business.name}</h3>
                      </div>
                      <p className="text-xs text-zinc-500 font-medium mt-0.5">{business.address || business.location}</p>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isServing
                        ? 'bg-emerald-600 text-white animate-pulse shadow-sm'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}>
                      {isServing ? '⚡ NOW SERVING' : 'WAITING IN LINE'}
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
                  <div className="text-xs text-zinc-600 space-y-1">
                    <p>
                      Service: <strong className="text-zinc-950">{myQueueItem.serviceType || 'General Service'}</strong>
                    </p>
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
                    <span>📺 View Live Screen</span>
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
              <span>🏪</span>
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
              <span>{cat.icon}</span>
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
            <p className="text-3xl">🔍</p>
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
              const activeService = selectedServices[biz._id] || services[0]?.name || 'General Service'
              const selectedServiceObj = services.find(s => s.name === activeService) || { duration: biz.averageServiceTime || 15, price: biz.basePrice || 0 }

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
                          <span className="text-lg">{biz.category === 'salon' ? '✂️' : '🩺'}</span>
                          <h3 className="text-base font-black text-zinc-950 tracking-tight">{biz.name}</h3>
                        </div>
                        <p className="text-xs text-zinc-500 font-medium mt-0.5 line-clamp-1">{biz.address || biz.location || 'Local Venue'}</p>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex-shrink-0 ${
                        biz.isOpen
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-700 border border-rose-200'
                      }`}>
                        {biz.isOpen ? '● OPEN' : '○ CLOSED'}
                      </span>
                    </div>

                    {/* LIVE PRESENT QUEUE METRICS BOX */}
                    <div className="grid grid-cols-3 gap-2 my-4 p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-center">
                      <div className="p-1">
                        <p className="text-[9px] uppercase font-black text-zinc-400 tracking-wider">Now Serving</p>
                        <p className="text-base font-black text-indigo-700 mt-0.5">
                          {servingToken ? `#${servingToken}` : 'Idle 💤'}
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

                    {/* Inline Service Selection */}
                    {services.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Select Desired Service</p>
                        <select
                          value={activeService}
                          onChange={(e) => setSelectedServices(prev => ({ ...prev, [biz._id]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-semibold bg-white text-zinc-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          {services.map((svc, sIdx) => (
                            <option key={sIdx} value={svc.name}>
                              {svc.name} — {svc.duration}m (₹{svc.price})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions */}
                  <div className="space-y-2 pt-2 border-t border-zinc-100">
                    {isUserInQueue ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/queue/${biz._id}`)}
                          className="flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <span>🎟️ In Line (Token #{userTokenIndex + 1})</span>
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
                            <span>⚡ Join Live Queue</span>
                            <span className="text-[10px] opacity-80">(~{selectedServiceObj.duration}m • ₹{selectedServiceObj.price})</span>
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
                      <button
                        onClick={() => navigate(`/booking/${biz._id}`)}
                        className="flex-1 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold transition-colors text-center text-[11px]"
                      >
                        Book Time Slot 📅
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── SECTION 3: APPOINTMENT RESERVATIONS & BOOKING HISTORY ── */}
      <section className="space-y-4 pt-4 border-t border-zinc-200">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
              <span>📅</span> My Appointments & Bookings
            </h2>
            <p className="text-xs text-zinc-500 font-medium">Scheduled time slots and historical visits.</p>
          </div>
        </div>

        {myBookings.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-2xl bg-white">
            No appointment bookings on record yet.
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-3xl border border-zinc-200 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase border-b border-zinc-100">
                <tr>
                  <th className="py-3.5 px-4">Date & Slot</th>
                  <th className="py-3.5 px-4">Business</th>
                  <th className="py-3.5 px-4">Service</th>
                  <th className="py-3.5 px-4">Paid</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {myBookings.map((b) => (
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
                          <span>👨‍⚕️</span>
                          <span>{b.assignedStaff.name}</span>
                          <span className="text-[10px] text-zinc-400 font-normal">({b.assignedStaff.role || 'On-Duty'})</span>
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-4 font-bold text-teal-700">₹{b.paidAmount}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        b.status === 'completed'
                          ? 'bg-zinc-100 text-zinc-600'
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
                        <button
                          onClick={() => handleOpenReview(b)}
                          className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg font-bold text-[11px]"
                        >
                          Review ★
                        </button>
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
