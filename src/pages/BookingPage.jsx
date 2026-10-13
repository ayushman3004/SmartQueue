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
import { STAFF_PRESETS } from '../utils/servicePresets'
import { toast } from 'react-hot-toast'
import { useSeo } from '../utils/useSeo'

export default function BookingPage() {
  const { businessId } = useParams()
  const { user, setUser } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()

  const [business, setBusiness] = useState(null)

  useSeo({
    title: business?.name ? `${business.name} — Book Appointment` : 'Book Appointment',
    description: 'Select services, choose available practitioners, and reserve priority slots on serveQ.',
    robots: 'noindex, nofollow',
  })
  const [slots, setSlots] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [meta, setMeta] = useState({ avgServiceTime: 10, aiBuffer: 0, ratePerMinute: 20 })
  const [loading, setLoading] = useState(true)

  // Booking Form State: Multiple Services & Doctor/Barber Selection
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedServices, setSelectedServices] = useState([])
  const [selectedStaff, setSelectedStaff] = useState('any') // 'any' or staff member object
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
  const [paymentChoice, setPaymentChoice] = useState('PAY_AT_BUSINESS')

  const fetchData = useCallback(async () => {
    try {
      const [bRes, sRes, mRes] = await Promise.all([
        getBusiness(businessId),
        getAvailableSlots(businessId, selectedDate),
        getMyBookings(),
      ])

      const biz = bRes.data.data.business
      setBusiness(biz)

      const pMode = biz.paymentConfiguration?.paymentMode || 'PAY_AT_BUSINESS'
      if (pMode === 'ONLINE') {
        setPaymentChoice('WALLET')
      } else {
        setPaymentChoice('PAY_AT_BUSINESS')
      }

      if (biz.services?.length > 0 && selectedServices.length === 0) {
        setSelectedServices([biz.services[0]])
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
  }, [businessId, selectedDate, selectedServices.length])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Socket updates
  useEffect(() => {
    if (!socket) return

    const handleDelay = (data) => {
      if (data.userId === user?._id) {
        toast(data.message)
        fetchData()
      }
    }
    const handleUpdate = () => fetchData()

    socket.on('booking:delayed', handleDelay)
    socket.on('bookings:updated', handleUpdate)
    socket.on('queue:update', handleUpdate)
    socket.on('service:started', handleUpdate)
    socket.on('service:completed', handleUpdate)
    return () => {
      socket.off('booking:delayed', handleDelay)
      socket.off('bookings:updated', handleUpdate)
      socket.off('queue:update', handleUpdate)
      socket.off('service:started', handleUpdate)
      socket.off('service:completed', handleUpdate)
    }
  }, [socket, user, fetchData])

  // Multiple services toggle handler
  const handleToggleService = (svc) => {
    setSelectedServices(prev => {
      const exists = prev.some(s => s.name === svc.name)
      if (exists) {
        if (prev.length <= 1) {
          toast.error("Please keep at least one service selected")
          return prev
        }
        return prev.filter(s => s.name !== svc.name)
      } else {
        return [...prev, svc]
      }
    })
  }

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
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service before choosing a time slot')
      return
    }
    setSelectedSlot(slot)
    setPaymentModalOpen(true)
  }

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service')
      return
    }

    setBookingInProgress(true)
    try {
      const combinedServiceNames = selectedServices.map(s => s.name).join(' + ')
      const preferredStaffName = selectedStaff === 'any' ? null : (selectedStaff?.name || selectedStaff)

      const res = await createBooking({
        businessId,
        startTime: selectedSlot.startTime,
        services: selectedServices,
        serviceType: combinedServiceNames,
        pricingLabel: combinedServiceNames,
        preferredStaff: preferredStaffName,
        couponCode: appliedCoupon?.coupon?.code,
        paymentMethod: paymentChoice,
      })

      const newBal = res.data.data.newBalance
      if (newBal !== undefined) {
        setUser(prev => prev ? { ...prev, walletBalance: newBal } : prev)
      }

      const assigned = res.data.data?.assignedStaff || res.data.data?.booking?.assignedStaff
      if (assigned?.name) {
        toast.success(`Booking confirmed! Assigned to ${assigned.name}${assigned.autoAssigned ? ' (On-Duty)' : ''}`)
      } else {
        toast.success(res.data.message || 'Booking confirmed!')
      }

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

  const isClinic = business?.category === 'clinic' || business?.category === 'healthcare'
  const staffRoleLabel = isClinic ? 'Doctor / Specialist' : 'Barber / Stylist'
  const staffRoleIcon = ''

  // Available staff list (use registered business staff or standard presets if empty)
  const availableStaffList = (business?.staff && business.staff.length > 0)
    ? business.staff
    : (STAFF_PRESETS[isClinic ? 'clinic' : 'salon']?.defaults || [])

  // Price and duration aggregations across multiple selected services
  const totalServiceDuration = selectedServices.reduce((sum, s) => sum + (Number(s.duration) || 15), 0)
  const totalServicePrice = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0)
  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0
  const finalPrice = Math.max(0, totalServicePrice - discountAmount)

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
                {business.phone && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Phone:{' '}
                    <a
                      href={`tel:${business.phone}`}
                      className="text-teal-700 hover:text-teal-800 font-semibold underline underline-offset-2 transition-colors"
                    >
                      {business.phone}
                    </a>
                  </p>
                )}
              </div>

              {/* Multi-Service Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">
                    Select Services (Choose Multiple)
                  </label>
                  <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                    {selectedServices.length} Selected • {totalServiceDuration}m
                  </span>
                </div>

                <div className="space-y-2">
                  {(business.services || [{ name: 'General Consultation', duration: 15, price: business.basePrice || 0 }]).map((svc, i) => {
                    const isSelected = selectedServices.some(s => s.name === svc.name)
                    return (
                      <div
                        key={i}
                        onClick={() => handleToggleService(svc)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-teal-50/80 border-teal-500 shadow-xs ring-1 ring-teal-500/30'
                            : 'bg-slate-50 border-zinc-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-lg border flex items-center justify-center text-xs font-black transition-colors ${
                            isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-zinc-300 bg-white text-transparent'
                          }`}>
                            ✓
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900 leading-tight">{svc.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5 font-medium">{svc.duration} minutes</p>
                          </div>
                        </div>
                        <span className="text-sm font-black text-teal-800">₹{svc.price ?? business.basePrice ?? 0}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="p-2.5 rounded-xl bg-teal-50/50 border border-teal-100 flex items-center justify-between text-xs">
                  <span className="text-zinc-600 font-medium">Selected Total:</span>
                  <span className="font-black text-teal-800">
                    {totalServiceDuration} mins • ₹{totalServicePrice}
                  </span>
                </div>
              </div>

              {/* Doctor / Barber Selection */}
              {business?.bookingSettings?.allowStaffSelection === false ? (
                <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs space-y-1">
                  <span className="font-bold text-zinc-800 flex items-center gap-1.5">
                    <span>Automated Staff Allocation</span>
                  </span>
                  <p className="text-zinc-500 text-[11px] leading-snug">
                    Staff members are assigned automatically by the venue management based on real-time on-duty availability.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pt-4 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">
                      Select {staffRoleLabel}
                    </label>
                    <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                      Auto-Fallback
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {/* Option 1: Any Available / Auto-Assign */}
                    <div
                      onClick={() => setSelectedStaff('any')}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        selectedStaff === 'any'
                          ? 'bg-teal-50/90 border-teal-500 ring-1 ring-teal-500/30'
                          : 'bg-slate-50 border-zinc-200 hover:bg-white'
                      }`}
                    >
                    <div>
                      <p className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
                        <span>Any Available {isClinic ? 'General Physician / Doctor' : 'Barber / Stylist'}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Auto-assigned to on-duty {isClinic ? 'General Physician' : 'Barber'} at selected slot
                      </p>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md flex-shrink-0">
                      Recommended
                    </span>
                  </div>

                  {/* Individual Staff Cards */}
                  {availableStaffList.map((member, idx) => {
                    const isOccupied = Boolean(member.isOccupied) || (
                      business?.activeQueue?.some(u => u.status === 'serving' && u.assignedStaff?.name?.toLowerCase() === member.name?.toLowerCase())
                    )
                    const isSelected = selectedStaff?._id === member._id || selectedStaff?.name === member.name
                    return (
                      <div
                        key={member._id || idx}
                        onClick={() => {
                          if (isOccupied) {
                            toast.error(`${member.name} is currently in service with a patron. Auto-fallback will assign an on-duty ${isClinic ? 'General Physician' : 'Barber'}.`)
                          }
                          setSelectedStaff(member)
                        }}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          isOccupied
                            ? 'bg-rose-50/70 border-rose-200'
                            : isSelected
                              ? 'bg-teal-50/90 border-teal-500 ring-1 ring-teal-500/30'
                              : 'bg-slate-50 border-zinc-200 hover:bg-white'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-zinc-900 truncate flex items-center gap-1.5">
                            <span>{member.name}</span>
                            {isOccupied && (
                              <span className="text-[9px] font-black uppercase tracking-wider text-rose-700 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded-md">
                                In Service
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {member.role || staffRoleLabel} {member.specialties ? `• ${Array.isArray(member.specialties) ? member.specialties.join(', ') : member.specialties}` : ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`text-[10px] font-bold block ${
                            isOccupied ? 'text-rose-600 font-extrabold' : member.isAvailable !== false ? 'text-emerald-700' : 'text-slate-400'
                          }`}>
                            {isOccupied ? 'In Service (Occupied)' : member.isAvailable !== false ? 'Available' : 'Off-Duty'}
                          </span>
                          <span className="text-[10px] text-amber-500 font-bold">Rating: {member.rating ? Number(member.rating).toFixed(1) : '5.0'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Auto-Assignment Guarantee Alert */}
                <div className="p-3 bg-teal-50/60 border border-teal-200/80 rounded-2xl text-[11px] text-teal-950 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-teal-800">
                    <span>Guaranteed On-Duty Coverage</span>
                  </p>
                  <p className="text-slate-600 leading-snug">
                    If your chosen {isClinic ? 'doctor' : 'barber'} is busy or unavailable at your slot, you will automatically be paired with {isClinic ? 'an on-duty General Physician' : 'any available Barber'} at that time.
                  </p>
                </div>
              </div>
              )}

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

                    <p className="text-xs text-slate-700 font-bold leading-tight">{b.serviceType}</p>

                    {/* Assigned Doctor / Barber Badge */}
                    {b.assignedStaff?.name && (
                      <div className="p-2 rounded-xl bg-teal-50 border border-teal-200/80 text-[11px] text-teal-900 flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1">
                          <span>{staffRoleIcon}</span>
                          <span>{b.assignedStaff.name}</span>
                          <span className="text-[10px] text-slate-500 font-normal">({b.assignedStaff.role || staffRoleLabel})</span>
                        </span>
                        {b.assignedStaff.autoAssigned && (
                          <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            On-Duty
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 font-medium">Paid: ₹{b.paidAmount}</p>

                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-200">
                      {b.status === 'completed' ? (
                        <button
                          onClick={() => handleOpenReview(b)}
                          className="text-xs font-bold text-teal-700 hover:underline"
                        >
                          Leave Review
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
                <span><strong>AI Pacing Active:</strong> +{meta.aiBuffer} mins safety buffer added based on historical extensions.</span>
              </div>
            )}

            {/* Appointments Disabled Warning */}
            {business?.bookingSettings?.enableAppointments === false ? (
              <div className="py-12 px-6 text-center border border-amber-200 bg-amber-50 rounded-2xl space-y-3">
                <h3 className="text-lg font-bold text-amber-950">Advance Bookings Disabled</h3>
                <p className="text-xs text-amber-800 max-w-md mx-auto">
                  This venue does not accept advance scheduled appointments. You can visit in person or join the live queue on the customer dashboard.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/queue/${businessId}`)}
                  className="px-4 py-2 bg-amber-800 text-white text-xs font-bold rounded-xl hover:bg-amber-900 transition-colors"
                >
                  Go to Live Queue
                </button>
              </div>
            ) : (
              <>
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
              </>
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

                {/* Multiple Services List */}
                <div className="space-y-1.5 py-1 border-t border-b border-zinc-200/60">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Selected Services ({selectedServices.length})
                  </span>
                  {selectedServices.map((svc, i) => (
                    <div key={i} className="flex justify-between items-center text-zinc-800">
                      <span className="font-medium">• {svc.name} ({svc.duration}m)</span>
                      <span className="font-bold text-teal-800">₹{svc.price}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-[11px] text-zinc-500 font-semibold pt-1">
                    <span>Total Service Time:</span>
                    <span>{totalServiceDuration} minutes</span>
                  </div>
                </div>

                {/* Assigned Staff */}
                <div className="flex justify-between items-start text-slate-600">
                  <span>{staffRoleLabel}</span>
                  <div className="text-right">
                    <span className="font-bold text-teal-800 flex items-center gap-1 justify-end">
                      <span>{selectedStaff === 'any' ? (`Any Available ${isClinic ? 'General Physician' : 'Barber'}`) : selectedStaff?.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {selectedStaff === 'any' ? 'On-duty auto-assignment' : (selectedStaff?.role || 'Staff')}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Time Slot</span>
                  <span className="font-bold text-zinc-900">{formatTime(selectedSlot?.startTime)}</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Services Subtotal</span>
                  <span className="font-bold text-zinc-900">₹{totalServicePrice}</span>
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

              {/* Payment Mode Selector / Details */}
              {business?.paymentConfiguration?.paymentMode === 'BOTH' ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 block">Select Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentChoice('PAY_AT_BUSINESS')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        paymentChoice === 'PAY_AT_BUSINESS'
                          ? 'border-teal-500 bg-teal-50/50 text-teal-950 font-bold'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="text-xs font-bold">Pay at Venue</div>
                      <div className="text-[10px] text-zinc-400">Cash / UPI QR at counter</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentChoice('WALLET')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        paymentChoice === 'WALLET'
                          ? 'border-teal-500 bg-teal-50/50 text-teal-950 font-bold'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="text-xs font-bold">Online Wallet</div>
                      <div className="text-[10px] text-zinc-400">Bal: ₹{user?.walletBalance ?? 0}</div>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Provider Notice */}
              {paymentChoice === 'PAY_AT_BUSINESS' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-950">
                  <p className="font-bold mb-0.5">Pay at Business (Zero Advance Online Charge)</p>
                  <p className="text-emerald-700 opacity-90">
                    Your appointment slot is confirmed immediately. Pay ₹{finalPrice} directly to the merchant upon arrival via cash or UPI.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-[11px] text-teal-900">
                  <p className="font-bold mb-0.5">Online Payment (Customer Wallet)</p>
                  <p className="text-teal-700 opacity-90">
                    Deducted from your wallet balance: ₹{user?.walletBalance ?? 0}.
                    {user?.walletBalance < finalPrice && (
                      <span className="text-rose-600 font-bold block mt-1">Warning: Balance is less than ₹{finalPrice}.</span>
                    )}
                  </p>
                </div>
              )}

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
                  disabled={bookingInProgress || (paymentChoice === 'WALLET' && (user?.walletBalance || 0) < finalPrice)}
                  className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 disabled:opacity-50"
                >
                  {bookingInProgress
                    ? 'Processing...'
                    : paymentChoice === 'PAY_AT_BUSINESS'
                    ? `Confirm Booking (Pay ₹${finalPrice} at Venue)`
                    : `Confirm & Pay ₹${finalPrice}`}
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
