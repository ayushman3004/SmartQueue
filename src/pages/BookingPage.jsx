import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getBusiness } from '../api/business.api'
import {
  getAvailableSlots,
  createBooking,
  getMyBookings,
  cancelBooking,
} from '../api/booking.api'
import { validateCoupon } from '../api/coupon.api'
import { submitReview } from '../api/review.api'
import { toast } from 'react-hot-toast'

export default function BookingPage() {
  const { businessId } = useParams()
  const { user, setUser } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()

  const [business, setBusiness] = useState(null)
  const [slots, setSlots] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [meta, setMeta] = useState({ avgServiceTime: 10, aiBuffer: 0, ratePerMinute: 20 })
  const [loading, setLoading] = useState(true)

  // Booking Form State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [bookingInProgress, setBookingInProgress] = useState(false)

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBookingForReview, setSelectedBookingForReview] = useState(null)
  const [rating, setRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [bRes, sRes, mRes] = await Promise.all([
        getBusiness(businessId),
        getAvailableSlots(businessId, selectedDate),
        getMyBookings(),
      ])

      const biz = bRes.data.data.business
      setBusiness(biz)
      if (biz.services?.length > 0 && !selectedService) {
        setSelectedService(biz.services[0])
      }

      setSlots(sRes.data.data.slots || [])
      setMeta({
        avgServiceTime: sRes.data.data.avgServiceTime,
        aiBuffer: sRes.data.data.aiBuffer,
        ratePerMinute: sRes.data.data.ratePerMinute,
      })
      setMyBookings(mRes.data.data.bookings.filter(b => b.businessId?._id === businessId || b.businessId === businessId))
    } catch (err) {
      console.error('Failed to load booking data', err)
    } finally {
      setLoading(false)
    }
  }, [businessId, selectedDate, selectedService])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Socket updates
  useEffect(() => {
    if (!socket) return

    const handleDelay = (data) => {
      if (data.userId === user?._id) {
        toast(data.message, { icon: '⏱️' })
        fetchData()
      }
    }
    const handleUpdate = () => fetchData()

    socket.on('booking:delayed', handleDelay)
    socket.on('bookings:updated', handleUpdate)
    return () => {
      socket.off('booking:delayed', handleDelay)
      socket.off('bookings:updated', handleUpdate)
    }
  }, [socket, user, fetchData])

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setValidatingCoupon(true)
    try {
      const res = await validateCoupon(couponCode.trim(), businessId)
      setAppliedCoupon(res.data.data)
      toast.success(`Coupon applied! Saved ₹${res.data.data.discountAmount}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid coupon')
      setAppliedCoupon(null)
    } finally {
      setValidatingCoupon(false)
    }
  }

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot)
    setPaymentModalOpen(true)
  }

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return
    setBookingInProgress(true)
    try {
      const res = await createBooking({
        businessId,
        startTime: selectedSlot.startTime,
        serviceType: selectedService?.name || 'general',
        pricingLabel: selectedService?.name || 'standard',
        couponCode: appliedCoupon?.coupon?.code,
      })

      const newBal = res.data.data.newBalance
      if (newBal !== undefined) {
        setUser(prev => prev ? { ...prev, walletBalance: newBal } : prev)
      }

      toast.success(res.data.message || 'Booking confirmed!')
      setPaymentModalOpen(false)
      setSelectedSlot(null)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed')
    } finally {
      setBookingInProgress(false)
    }
  }

  const handleCancel = async (id) => {
    if (!window.confirm("Cancel this booking? Amount will be refunded to your wallet.")) return
    try {
      const res = await cancelBooking(id)
      toast.success(res.data.message || 'Booking cancelled')
      if (res.data.data?.refunded) {
        setUser(prev => prev ? { ...prev, walletBalance: (prev.walletBalance || 0) + res.data.data.refunded } : prev)
      }
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed')
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
      toast.success("Review submitted! Thank you.")
      setReviewModalOpen(false)
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit review")
    } finally {
      setSubmittingReview(false)
    }
  }

  const formatTime = (iso) => {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  // Price calculations
  const servicePrice = selectedService?.price ?? (business?.basePrice || 0)
  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0
  const finalPrice = Math.max(0, servicePrice - discountAmount)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="container max-w-7xl py-10 px-4 sm:px-6 space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-zinc-950 px-4 py-2 rounded-xl bg-slate-50 border border-zinc-200 hover:bg-white transition-all"
        >
          ← Back to Directory
        </button>
        <button
          onClick={() => navigate(`/queue/${businessId}`)}
          className="flex items-center gap-2 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-4 py-2 rounded-xl hover:bg-teal-100 transition-all"
        >
          View Live Queue ({business?.queueLength || 0} waiting) →
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Venue Info, Service Selection & My Bookings */}
        <div className="lg:col-span-4 space-y-6">
          {business && (
            <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-2xl font-black text-zinc-950 tracking-tight">{business.name}</h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${business.isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {business.isOpen ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 capitalize">{business.category} • {business.address || business.location || 'Local Hub'}</p>
                {business.phone && <p className="text-xs text-slate-400 mt-0.5">📞 {business.phone}</p>}
              </div>

              {/* Service Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">Select Service</label>
                <div className="space-y-2">
                  {(business.services || [{ name: 'General Consultation', duration: 15, price: business.basePrice || 0 }]).map((svc, i) => {
                    const isSelected = selectedService?.name === svc.name
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedService(svc)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected ? 'bg-teal-50 border-teal-500 shadow-xs' : 'bg-slate-50 border-zinc-200 hover:bg-white'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-bold text-zinc-900 leading-none">{svc.name}</p>
                          <p className="text-xs text-slate-400 mt-1">{svc.duration} minutes</p>
                        </div>
                        <span className="text-sm font-black text-teal-800">₹{svc.price ?? business.basePrice ?? 0}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Coupon Section */}
              <div className="space-y-2 pt-4 border-t border-zinc-100">
                <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">Have a coupon?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code (e.g. SERVEQ15)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 text-xs uppercase font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon || !couponCode}
                    className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
                {appliedCoupon && (
                  <p className="text-xs text-emerald-700 font-bold">✓ Coupon active: -₹{appliedCoupon.discountAmount}</p>
                )}
              </div>
            </div>
          )}

          {/* User's Existing Bookings for this business */}
          <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-zinc-950 tracking-wider">Your Bookings at this Venue</h3>
            {myBookings.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-zinc-200 rounded-2xl">
                No past or pending bookings here yet.
              </p>
            ) : (
              <div className="space-y-3">
                {myBookings.map((b) => (
                  <div key={b._id} className="p-4 rounded-2xl bg-slate-50 border border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-900">{formatTime(b.startTime)}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        b.status === 'completed' ? 'bg-slate-200 text-slate-700' :
                        b.status === 'serving' ? 'bg-emerald-100 text-emerald-700' :
                        b.status === 'cancelled' || b.status === 'refunded' ? 'bg-rose-100 text-rose-700' :
                        'bg-teal-100 text-teal-800'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{b.serviceType} • Paid ₹{b.paidAmount}</p>
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-200">
                      {b.status === 'completed' ? (
                        <button
                          onClick={() => handleOpenReview(b)}
                          className="text-xs font-bold text-teal-700 hover:underline"
                        >
                          ⭐ Leave Review
                        </button>
                      ) : b.status === 'scheduled' || b.status === 'confirmed' ? (
                        <button
                          onClick={() => handleCancel(b._id)}
                          className="text-xs font-bold text-rose-600 hover:underline"
                        >
                          Cancel Booking
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Date Selection & Available Slots */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-zinc-200 p-8 rounded-3xl shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
              <div>
                <h2 className="text-2xl font-black text-zinc-950">Select Time Slot</h2>
                <p className="text-xs text-slate-500 font-medium">Slots calculated dynamically with AI extension buffering.</p>
              </div>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => { setSelectedDate(e.target.value); setLoading(true) }}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {meta.aiBuffer > 0 && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-center gap-2">
                <span>🧠</span>
                <span><strong>AI Pacing Active:</strong> +{meta.aiBuffer} mins safety buffer added based on historical extensions.</span>
              </div>
            )}

            {/* Slots Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {slots.map((slot, i) => {
                const isPast = new Date(slot.startTime) < new Date()
                const isAvailable = slot.available && !isPast

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => handleSlotSelect(slot)}
                    className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-between min-h-[90px] ${
                      isAvailable
                        ? 'bg-slate-50 border-zinc-200 hover:border-teal-500 hover:bg-teal-50/40 cursor-pointer shadow-xs'
                        : 'bg-zinc-50 border-zinc-100 text-slate-300 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span className="text-sm font-black text-zinc-900">{formatTime(slot.startTime)}</span>
                    <span className="text-[10px] text-slate-400 font-bold">{slot.duration} mins</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md mt-1 ${
                      isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {isAvailable ? 'Available' : 'Booked'}
                    </span>
                  </button>
                )
              })}
            </div>

            {slots.length === 0 && (
              <div className="py-16 text-center text-slate-400 border border-dashed border-zinc-200 rounded-3xl">
                No slots available on this date. Please try another day.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      <AnimatePresence>
        {paymentModalOpen && (
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
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-xl font-black text-zinc-950">Payment Confirmation</h3>
                  <p className="text-xs text-slate-400">Order Summary & Confirmation</p>
                </div>
                <button onClick={() => setPaymentModalOpen(false)} className="text-slate-400 hover:text-zinc-900 font-bold">✕</button>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-zinc-100 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Venue</span>
                  <span className="font-bold text-zinc-900">{business?.name}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Service</span>
                  <span className="font-bold text-zinc-900">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Time Slot</span>
                  <span className="font-bold text-zinc-900">{formatTime(selectedSlot?.startTime)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Base Price</span>
                  <span className="font-bold text-zinc-900">₹{servicePrice}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Coupon ({appliedCoupon?.coupon?.code})</span>
                    <span>-₹{discountAmount}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-zinc-200 flex justify-between text-sm font-black text-zinc-950">
                  <span>Total Payable</span>
                  <span className="text-teal-700">₹{finalPrice}</span>
                </div>
              </div>

              {/* Provider Notice */}
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-[11px] text-teal-900">
                <p className="font-bold mb-0.5">🔒 Payment Provider: Mock Payment Gateway (Test Mode)</p>
                <p className="text-teal-700 opacity-90">Safe financial ledger check. Wallet balance: ₹{user?.walletBalance ?? 0}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-zinc-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={bookingInProgress}
                  className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 disabled:opacity-50"
                >
                  {bookingInProgress ? 'Processing...' : `Confirm & Pay ₹${finalPrice}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <p className="text-xs text-slate-500">{business?.name}</p>
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
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Comments</label>
                  <textarea
                    rows={4}
                    placeholder="Share details of your experience..."
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
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
