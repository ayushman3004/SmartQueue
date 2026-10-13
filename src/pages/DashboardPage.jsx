import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getAllBusinesses, getMyBusinesses } from '../api/business.api'
import { getMyBookings, cancelBooking } from '../api/booking.api'
import { getAvailableCoupons } from '../api/coupon.api'
import { submitReview } from '../api/review.api'
import BusinessCard from '../components/BusinessCard'
import { CATEGORY_METADATA } from '../utils/servicePresets'
import { toast } from 'react-hot-toast'
import { useDebounce } from '../hooks/useDebounce'

const CATEGORIES = ['all', 'salon', 'clinic']

export default function DashboardPage() {
  const { user, setUser } = useAuth()
  const isOwner = user?.role === 'owner'

  if (isOwner) {
    return <Navigate to="/business" replace />
  }
  const navigate = useNavigate()
  const { onBusinessStatus, socket } = useSocket()

  const [businesses, setBusinesses] = useState([])
  const [myBusinesses, setMyBusinesses] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [category, setCategory] = useState('all')

  const debouncedSearch = useDebounce(search, 350)
  const debouncedLocation = useDebounce(locationQuery, 350)

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBookingForReview, setSelectedBookingForReview] = useState(null)
  const [rating, setRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Coupon Drawer / Modal
  const [showCoupons, setShowCoupons] = useState(false)

  // Hub Owner Modals
  const [registerHubOpen, setRegisterHubOpen] = useState(false)
  const [manageServicesBiz, setManageServicesBiz] = useState(null)


  const handleHubCreated = (newBiz) => {
    setMyBusinesses(prev => [newBiz, ...prev])
    setBusinesses(prev => [newBiz, ...prev])
  }

  const handleHubUpdated = (updatedBiz) => {
    setMyBusinesses(prev => prev.map(b => b._id === updatedBiz._id ? updatedBiz : b))
    setBusinesses(prev => prev.map(b => b._id === updatedBiz._id ? updatedBiz : b))
  }

  const fetchData = useCallback(async () => {
    try {
      const [allRes, myBRes, myBkRes, coupRes] = await Promise.all([
        getAllBusinesses({ search: debouncedSearch, category, location: debouncedLocation }),
        isOwner ? getMyBusinesses().catch(() => ({ data: { data: { businesses: [] } } })) : Promise.resolve({ data: { data: { businesses: [] } } }),
        getMyBookings().catch(() => ({ data: { data: { bookings: [] } } })),
        getAvailableCoupons().catch(() => ({ data: { data: { coupons: [] } } })),
      ])

      setBusinesses(allRes.data.data.businesses || [])
      if (isOwner) setMyBusinesses(myBRes.data.data.businesses || [])
      setMyBookings(myBkRes.data.data.bookings || [])
      setCoupons(coupRes.data.data.coupons || [])
    } catch (err) {
      console.error("Dashboard fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, category, debouncedLocation, isOwner])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Realtime updates
  useEffect(() => {
    const unsubStatus = onBusinessStatus((data) => {
      setBusinesses(prev => {
        if (data.isActive === false) return prev.filter(b => b._id !== data.businessId)
        return prev.map(b => b._id === data.businessId ? { ...b, isOpen: data.isOpen, isActive: data.isActive } : b)
      })
      if (isOwner) {
        setMyBusinesses(prev => prev.map(b => b._id === data.businessId ? { ...b, isOpen: data.isOpen } : b))
      }
    })

    const handleQueueUpdate = () => {
      getMyBookings().then(res => setMyBookings(res.data.data.bookings || [])).catch(() => {})
    }

    socket?.on('bookings:updated', handleQueueUpdate)
    socket?.on('queue:updated', handleQueueUpdate)

    return () => {
      unsubStatus?.()
      socket?.off('bookings:updated', handleQueueUpdate)
      socket?.off('queue:updated', handleQueueUpdate)
    }
  }, [onBusinessStatus, socket, isOwner])

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking? Paid amounts will be refunded to your wallet.")) return
    try {
      const res = await cancelBooking(bookingId)
      toast.success(res.data.message || "Booking cancelled and refunded")
      getMyBookings().then(r => setMyBookings(r.data.data.bookings || []))
      // Update wallet if refunded
      if (res.data.data?.refunded) {
        setUser(prev => prev ? { ...prev, walletBalance: (prev.walletBalance || 0) + res.data.data.refunded } : prev)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel")
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
      toast.success("Thank you! Review submitted successfully.")
      setReviewModalOpen(false)
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit review")
    } finally {
      setSubmittingReview(false)
    }
  }

  // Recommended Businesses (Fastest ETA & Open)
  const recommendedBusinesses = [...businesses]
    .filter(b => b.isOpen && b.isActive)
    .sort((a, b) => (a.estimatedWait || 0) - (b.estimatedWait || 0))
    .slice(0, 3)

  return (
    <div className="container max-w-7xl pt-4 pb-24 space-y-12 px-4 sm:px-6">

      {/* Top Banner & Quick Navigation (Double-Bezel Shell) */}
      <div className="bezel-shell">
        <div className="bezel-core bg-gradient-to-br from-zinc-950 via-zinc-900 to-teal-950 p-6 sm:p-8 md:p-10 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-zinc-800">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="space-y-3 z-10 max-w-xl text-left">
            <div className="badge-eyebrow bg-teal-500/20 text-teal-300 border-teal-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Live Operations Gateway
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none text-white">
              Welcome, {user?.name?.split(' ')[0] || 'Member'}
            </h1>
            <p className="text-zinc-300 text-sm font-medium leading-relaxed max-w-lg">
              Monitor real-time queue lengths, reserve express slots, and avoid waiting in physical lines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 z-10">
            <button
              onClick={() => navigate('/wallet')}
              className="group flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/20 px-4.5 py-2.5 rounded-full backdrop-blur-md transition-all active:scale-[0.97] shadow-sm"
            >
              <span className="w-8 h-8 rounded-full bg-teal-500/30 flex items-center justify-center text-xs font-black text-white">₹</span>
              <div className="text-left">
                <p className="text-[9px] uppercase font-black text-teal-300 tracking-wider leading-none">Wallet</p>
                <p className="text-sm font-black text-white mt-0.5">₹{(user?.walletBalance ?? 0).toLocaleString()}</p>
              </div>
            </button>

            <button
              onClick={() => setShowCoupons(!showCoupons)}
              className="btn-island py-2.5 px-5 text-xs bg-teal-500 hover:bg-teal-400 text-teal-950 shadow-teal-500/20"
            >
              <span>Coupons ({coupons.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Available Coupons Drawer */}
      <AnimatePresence>
        {showCoupons && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="bezel-shell"
          >
            <div className="bezel-core p-6 space-y-4 text-left">
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
                  <div key={idx} className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200/80 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[11px] font-black text-teal-900 bg-teal-200/70 px-2 py-0.5 rounded-md tracking-wider">{c.code}</span>
                      <p className="text-xs text-zinc-600 mt-1 font-medium">{c.description || `Save ₹${c.amount} on checkout`}</p>
                    </div>
                    <span className="text-base font-black text-teal-700">₹{c.amount} OFF</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Customer's Active Bookings & History */}
      <section className="space-y-6 text-left">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <h2 className="text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
              My Live Tickets & Bookings
            </h2>
            <p className="text-xs text-zinc-500 font-medium">Monitor active queue status, arrival timers, and historical receipts.</p>
          </div>
        </div>

        {myBookings.length === 0 ? (
          <div className="bezel-shell">
            <div className="bezel-core p-10 text-center space-y-2">
              <p className="text-sm font-black text-zinc-800">No active reservations yet.</p>
              <p className="text-xs text-zinc-400 font-medium">Select any verified business below to join the live queue or reserve an appointment.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myBookings.slice(0, 6).map((b) => (
              <div key={b._id} className="bezel-shell">
                <div className="bezel-core p-5 flex flex-col justify-between space-y-4 h-full">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-zinc-950 tracking-tight">{b.businessId?.name || 'Business Hub'}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        b.status === 'serving' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse' :
                        b.status === 'completed' ? 'bg-zinc-100 text-zinc-600' :
                        b.status === 'delayed' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        b.status === 'cancelled' || b.status === 'refunded' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-teal-50 text-teal-800 border border-teal-200'
                      }`}>
                        {b.status}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 mb-1">
                      Slot: <strong className="text-zinc-800">{new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> ({b.duration} mins)
                    </p>
                    <p className="text-xs text-zinc-500">Service: <span className="font-semibold text-zinc-800">{b.serviceType}</span> • Paid: ₹{b.paidAmount}</p>

                    {b.delayMinutes > 0 && (
                      <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold">
                        Delayed by {b.delayMinutes} min.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-zinc-100">
                    {b.status === 'completed' ? (
                      <button
                        onClick={() => handleOpenReview(b)}
                        className="flex-1 py-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-black text-xs hover:bg-teal-100 transition-colors active:scale-[0.98]"
                      >
                        Leave Review
                      </button>
                    ) : b.status === 'cancelled' || b.status === 'refunded' ? (
                      <span className="text-xs font-semibold text-zinc-400">Archived Record</span>
                    ) : (
                      <>
                        <button
                          onClick={() => navigate(`/queue/${b.businessId?._id || b.businessId}`)}
                          className="flex-1 py-2.5 rounded-full bg-teal-600 text-white font-black text-xs hover:bg-teal-700 transition-colors active:scale-[0.98] shadow-xs"
                        >
                          View Status
                        </button>
                        <button
                          onClick={() => handleCancelBooking(b._id)}
                          className="py-2.5 px-3.5 rounded-full border border-zinc-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors active:scale-[0.98]"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recommended Hubs (Fastest wait time) */}
      {recommendedBusinesses.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
                Recommended Fast-Track Hubs
              </h2>
              <p className="text-xs text-slate-500 font-medium">Venues with minimal queues and rapid turnaround times.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendedBusinesses.map((b, i) => (
              <BusinessCard key={b._id} business={b} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Explore & Search Directory */}
      <section className="space-y-6 text-left">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <h2 className="text-2xl font-black text-zinc-950 tracking-tight">Browse Venues & Services</h2>
            <p className="text-xs text-zinc-500 font-medium">Filter by category, search by service, venue name, or location.</p>
          </div>

          {/* Search and Location Fields */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search hub or service..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10 pr-4 py-2.5 rounded-full text-xs font-semibold bg-white"
              />
            </div>

            <div className="relative w-full sm:w-52">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input
                type="text"
                placeholder="City or Area..."
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                className="input pl-10 pr-4 py-2.5 rounded-full text-xs font-semibold bg-white"
              />
            </div>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {CATEGORIES.map((c) => {
            const label = c === 'all' ? 'All Venues' : c === 'salon' ? 'Salons' : 'Clinics'
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-2 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap active:scale-[0.96] ${
                  category === c
                    ? 'bg-zinc-950 text-white shadow-md shadow-zinc-950/20'
                    : 'bg-white border border-zinc-200/90 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Businesses Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="bezel-shell">
                <div className="bezel-core h-64 bg-zinc-100/60 animate-pulse" />
              </div>
            ))}
          </div>
        ) : businesses.length === 0 ? (
          <div className="bezel-shell">
            <div className="bezel-core p-16 text-center space-y-3">
              <h3 className="text-lg font-black text-zinc-900">No matching hubs found</h3>
              <p className="text-xs text-zinc-500 font-medium">Try broadening your search terms or selecting a different category.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {businesses.map((b, i) => (
              <BusinessCard key={b._id} business={b} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Review Modal */}
      <AnimatePresence>
        {reviewModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-zinc-200 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-zinc-950">Review Service</h3>
                  <p className="text-xs text-slate-500">{selectedBookingForReview?.businessId?.name}</p>
                </div>
                <button onClick={() => setReviewModalOpen(false)} className="text-slate-400 hover:text-zinc-900 font-bold">✕</button>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Rating</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRating(star)}
                        className={`text-2xl transition-transform hover:scale-110 ${star <= rating ? 'text-amber-400' : 'text-slate-200'}`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="text-xs font-bold text-slate-600 ml-2">{rating} / 5 Stars</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Feedback & Comments</label>
                  <textarea
                    rows={4}
                    placeholder="How was your service experience?"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full p-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-zinc-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 disabled:opacity-50"
                  >
                    {submittingReview ? 'Submitting...' : 'Post Review'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hub Registration Modal for Owners */}
      <RegisterHubModal
        isOpen={registerHubOpen}
        onClose={() => setRegisterHubOpen(false)}
        onCreated={handleHubCreated}
      />

      {/* Quick Services Management Modal for Owners */}
      <ManageServicesModal
        isOpen={!!manageServicesBiz}
        business={manageServicesBiz}
        onClose={() => setManageServicesBiz(null)}
        onUpdated={handleHubUpdated}
      />

    </div>
  )
}
