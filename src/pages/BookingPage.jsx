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
  Phone,
  ShieldCheck,
  Tag,
  CreditCard,
  Building,
} from 'lucide-react'
import CustomerSidebar from '../components/CustomerSidebar'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getAllBusinesses, getBusiness } from '../api/business.api'
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

export default function BookingPage() {
  const { businessId: paramBizId } = useParams()
  const { user, setUser, logOut } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()

  // Data states
  const [businesses, setBusinesses] = useState([])
  const [selectedBizId, setSelectedBizId] = useState(paramBizId || null)
  const [business, setBusiness] = useState(null)
  const [slots, setSlots] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [meta, setMeta] = useState({ avgServiceTime: 10, aiBuffer: 0, ratePerMinute: 20 })
  const [loading, setLoading] = useState(true)

  // Booking Form State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedServices, setSelectedServices] = useState([])
  const [selectedStaff, setSelectedStaff] = useState('any')
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [bookingInProgress, setBookingInProgress] = useState(false)
  const [isSubscriptionInactive, setIsSubscriptionInactive] = useState(false)

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBookingForReview, setSelectedBookingForReview] = useState(null)
  const [rating, setRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Header & Navigation states
  const [selectedCity, setSelectedCity] = useState(POPULAR_LOCATIONS[0])
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useSeo({
    title: business?.name ? `${business.name} — Book Appointment | serveQ` : 'Book Appointment | serveQ',
    description: 'Select services, choose available practitioners, and reserve priority slots on serveQ.',
    robots: 'noindex, nofollow',
  })

  // Load all businesses first (to support /booking without param and venue switcher)
  useEffect(() => {
    getAllBusinesses({ includeAll: false })
      .then((res) => {
        const bizList = res.data?.data?.businesses || []
        setBusinesses(bizList)
        if (!selectedBizId && bizList.length > 0) {
          setSelectedBizId(bizList[0]._id)
        }
      })
      .catch(() => {})
  }, [selectedBizId])

  // Sync selectedBizId with paramBizId if URL changes
  useEffect(() => {
    if (paramBizId) {
      setSelectedBizId(paramBizId)
    }
  }, [paramBizId])

  // Fetch business details, available slots, and bookings
  const fetchData = useCallback(async () => {
    if (!selectedBizId) return
    try {
      setLoading(true)
      setIsSubscriptionInactive(false)

      const bRes = await getBusiness(selectedBizId)
      const biz = bRes.data.data.business
      setBusiness(biz)

      // Default select first service if none selected or if switching venue
      if (biz.services?.length > 0 && selectedServices.length === 0) {
        setSelectedServices([biz.services[0]])
      }

      // If business subscription is inactive, do not fetch slots or allow booking
      if (biz.isSubscriptionActive === false) {
        setIsSubscriptionInactive(true)
        setSlots([])
        setLoading(false)
        return
      }

      const [sRes, mRes] = await Promise.all([
        getAvailableSlots(selectedBizId, selectedDate).catch((sErr) => {
          if (sErr.response?.status === 403 && sErr.response?.data?.message?.includes('subscription')) {
            setIsSubscriptionInactive(true)
          }
          return { data: { data: { slots: [] } } }
        }),
        getMyBookings().catch(() => ({ data: { data: { bookings: [] } } })),
      ])

      setSlots(sRes.data.data.slots || [])
      setMeta({
        avgServiceTime: sRes.data.data.avgServiceTime || 15,
        aiBuffer: sRes.data.data.aiBuffer || 0,
        ratePerMinute: sRes.data.data.ratePerMinute || 20,
      })

      const allBks = mRes.data.data.bookings || []
      setMyBookings(
        allBks.filter(
          (b) =>
            (b.businessId?._id || b.businessId)?.toString() === selectedBizId.toString()
        )
      )
    } catch (err) {
      console.error('Failed to load booking data', err)
      if (err.response?.status === 403 && err.response?.data?.message?.includes('subscription')) {
        setIsSubscriptionInactive(true)
      } else {
        toast.error('Unable to fetch appointment slots')
      }
    } finally {
      setLoading(false)
    }
  }, [selectedBizId, selectedDate, selectedServices.length])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time socket updates
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

  // Toggle multiple services
  const handleToggleService = (svc) => {
    setSelectedServices((prev) => {
      const exists = prev.some((s) => s.name === svc.name)
      if (exists) {
        if (prev.length <= 1) {
          toast.error('Please keep at least one service selected')
          return prev
        }
        return prev.filter((s) => s.name !== svc.name)
      } else {
        return [...prev, svc]
      }
    })
  }

  // Coupon handling
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !selectedBizId) return
    setValidatingCoupon(true)
    try {
      const res = await validateCoupon(couponCode.trim(), selectedBizId)
      setAppliedCoupon(res.data.data)
      toast.success(`Coupon applied! Saved ₹${res.data.data.discountAmount}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid coupon')
      setAppliedCoupon(null)
    } finally {
      setValidatingCoupon(false)
    }
  }

  // Select slot
  const handleSlotSelect = (slot) => {
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service before choosing a time slot')
      return
    }
    setSelectedSlot(slot)
    const canOnline =
      (business?.paymentConfiguration?.paymentMode === 'ONLINE' ||
        business?.paymentConfiguration?.paymentMode === 'BOTH') &&
      business?.paymentConfiguration?.onlinePaymentStatus === 'ACTIVE'

    if (business?.paymentConfiguration?.paymentMode === 'ONLINE' && canOnline) {
      setPaymentChoice('ONLINE')
    } else {
      setPaymentChoice('PAY_AT_BUSINESS')
    }
    setPaymentModalOpen(true)
  }

  // Confirm booking (Pay at Counter only)
  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedBizId) return
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service')
      return
    }

    setBookingInProgress(true)
    try {
      const combinedServiceNames = selectedServices.map((s) => s.name).join(' + ')
      const preferredStaffName = selectedStaff === 'any' ? null : selectedStaff?.name || selectedStaff

      // Create Booking record with counter payment settlement
      const res = await createBooking({
        businessId: selectedBizId,
        startTime: selectedSlot.startTime,
        services: selectedServices,
        serviceType: combinedServiceNames,
        pricingLabel: combinedServiceNames,
        preferredStaff: preferredStaffName,
        couponCode: appliedCoupon?.coupon?.code,
        paymentMethod: 'counter',
      })

      const booking = res.data.data?.booking || res.data.data
      const assigned = res.data.data?.assignedStaff || booking?.assignedStaff
      if (assigned?.name) {
        toast.success(
          `Booking confirmed! Assigned to ${assigned.name}${assigned.autoAssigned ? ' (On-Duty)' : ''}`
        )
      } else {
        toast.success(res.data.message || 'Booking confirmed! Pay at counter upon arrival.')
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

  // Cancel booking
  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return
    try {
      const res = await cancelBooking(id)
      toast.success(res.data.message || 'Booking cancelled')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed')
    }
  }

  // Review handling
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
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const formatTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const isClinic = business?.category === 'clinic' || business?.category === 'healthcare'
  const isSalon = business?.category === 'salon' || business?.category === 'barbershop'
  const staffRoleLabel = isClinic ? 'Doctor / Specialist' : 'Barber / Stylist'

  // Available staff
  const availableStaffList = useMemo(() => {
    if (business?.staff && business.staff.length > 0) return business.staff
    return STAFF_PRESETS[isClinic ? 'clinic' : 'salon']?.defaults || []
  }, [business?.staff, isClinic])

  // Price calculations
  const totalServiceDuration = selectedServices.reduce(
    (sum, s) => sum + (Number(s.duration) || 15),
    0
  )
  const totalServicePrice = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0)
  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0
  const finalPrice = Math.max(0, totalServicePrice - discountAmount)

  return (
    <div className="min-h-screen app-background-glow text-zinc-900 flex flex-col font-sans relative overflow-x-hidden">
      {/* ── TOP HEADER BAR (UNIFIED WITH OTHER PAGES) ── */}
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
              placeholder="Search clinic or salon for appointment..."
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

      {/* ── BODY: SIDEBAR + MAIN CANVAS (UNIFIED DESIGN) ── */}
      <div className="flex-1 flex w-full">
        {/* CUSTOMER SIDEBAR (DESKTOP + ANIMATED MOBILE DRAWER) */}
        <CustomerSidebar
          activeNavTab="appointments"
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
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight font-sans">
                Book an Appointment
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1">
                Reserve guaranteed priority slots at verified clinics and salons with zero waiting.
              </p>
            </div>

            {business && (
              <button
                onClick={() => navigate(`/queue/${business._id}`)}
                className="self-start sm:self-auto px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold text-xs flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-700" />
                <span>View Live Queue ({business.activeQueue?.length || business.queueLength || 0} in line)</span>
                <ChevronRight className="w-3 h-3 text-emerald-600" />
              </button>
            )}
          </div>

          {/* Quick Venue Switcher (Pill Row) */}
          {businesses.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-zinc-400 shrink-0 uppercase tracking-wider">
                Select Venue:
              </span>
              {businesses.map((b) => {
                const isSelected = (selectedBizId || business?._id) === b._id
                return (
                  <button
                    key={b._id}
                    onClick={() => {
                      setSelectedBizId(b._id)
                      navigate(`/booking/${b._id}`)
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#114227] text-white shadow-xs'
                        : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <span>{b.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {b.category === 'clinic' ? 'Clinic' : 'Salon'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {loading ? (
            <div className="p-16 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-3xl bg-white space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-semibold text-zinc-600">Loading appointment availability...</p>
            </div>
          ) : !business ? (
            <div className="p-12 text-center text-zinc-500 border border-dashed border-zinc-300 rounded-3xl bg-white space-y-3">
              <Building className="w-10 h-10 text-zinc-400 mx-auto" />
              <p className="font-bold text-zinc-800 text-base">No venue selected</p>
              <p className="text-xs text-zinc-500">Please choose a clinic or salon to book your appointment.</p>
              <button
                onClick={() => navigate('/customers')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-[#114227] text-white font-bold text-xs"
              >
                Explore Venues
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* ── LEFT COLUMN: VENUE INFO, MULTI-SERVICE SELECTION & SPECIALIST ── */}
              <div className="lg:col-span-5 space-y-6">
                {/* Venue Overview Card */}
                <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs space-y-4">
                  <div className="flex items-start gap-4">
                    <img
                      src={
                        business.images?.[0] ||
                        (isSalon ? DEFAULT_SALON_IMAGE : DEFAULT_CLINIC_IMAGE)
                      }
                      alt={business.name}
                      className="w-16 h-16 rounded-2xl object-cover border border-zinc-200 shrink-0"
                      onError={(e) => {
                        e.currentTarget.src = isSalon ? DEFAULT_SALON_IMAGE : DEFAULT_CLINIC_IMAGE
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-lg font-black text-zinc-950 truncate tracking-tight">
                          {business.name}
                        </h2>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                            business.isOpen
                              ? 'bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {business.isOpen ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 capitalize mt-0.5">
                        {business.category || 'Service Hub'} • {business.address || business.location || 'Local Hub'}
                      </p>
                      {business.phone && (
                        <p className="text-xs text-zinc-600 mt-1 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-zinc-400" />
                          <a
                            href={`tel:${business.phone}`}
                            className="text-[#114227] hover:underline font-semibold"
                          >
                            {business.phone}
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Multi-Service Selection */}
                <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Select Services
                      </h3>
                      <p className="text-xs text-zinc-600 font-bold mt-0.5">
                        {selectedServices.length} Selected • {totalServiceDuration} mins total
                      </p>
                    </div>
                    <span className="text-[11px] font-black text-[#114227] bg-[#EAF7EE] border border-[#BDE8CB] px-2.5 py-1 rounded-xl">
                      ₹{totalServicePrice}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(business.services || [
                      { name: 'General Consultation', duration: 15, price: business.basePrice || 0 },
                    ]).map((svc, i) => {
                      const isSelected = selectedServices.some((s) => s.name === svc.name)
                      return (
                        <div
                          key={i}
                          onClick={() => handleToggleService(svc)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-50/80 border-[#16A34A] ring-1 ring-[#16A34A]/30 shadow-2xs'
                              : 'bg-zinc-50/60 border-zinc-200 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-5 h-5 rounded-lg border flex items-center justify-center text-xs font-bold transition-colors shrink-0 ${
                                isSelected
                                  ? 'bg-[#114227] border-[#114227] text-white'
                                  : 'border-zinc-300 bg-white text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-950 truncate leading-tight">
                                {svc.name}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
                                {svc.duration} minutes
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-black text-[#114227] shrink-0 pl-2">
                            ₹{svc.price ?? business.basePrice ?? 0}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Doctor / Specialist Selector */}
                {business?.bookingSettings?.allowStaffSelection !== false && (
                  <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Choose {staffRoleLabel}
                      </h3>
                      <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Auto-Fallback Included
                      </span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {/* Option 1: Any Available */}
                      <div
                        onClick={() => setSelectedStaff('any')}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          selectedStaff === 'any'
                            ? 'bg-emerald-50/90 border-[#16A34A] ring-1 ring-[#16A34A]/30'
                            : 'bg-zinc-50 border-zinc-200 hover:bg-white'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-black text-zinc-950">
                            Any Available {isClinic ? 'Doctor' : 'Stylist'}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            Auto-assigns fastest available on-duty staff at your slot
                          </p>
                        </div>
                        <span className="text-[10px] font-black uppercase bg-[#114227] text-white px-2 py-0.5 rounded-md shrink-0">
                          Recommended
                        </span>
                      </div>

                      {/* Individual Staff Cards */}
                      {availableStaffList.map((member, idx) => {
                        const isOccupied =
                          Boolean(member.isOccupied) ||
                          business?.activeQueue?.some(
                            (u) =>
                              u.status === 'serving' &&
                              u.assignedStaff?.name?.toLowerCase() === member.name?.toLowerCase()
                          )
                        const isSelected =
                          selectedStaff?._id === member._id || selectedStaff?.name === member.name

                        return (
                          <div
                            key={member._id || idx}
                            onClick={() => {
                              if (isOccupied) {
                                toast(
                                  `${member.name} is currently with a patron. If still occupied at slot time, auto-fallback will assign an on-duty specialist.`
                                )
                              }
                              setSelectedStaff(member)
                            }}
                            className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                              isOccupied
                                ? 'bg-amber-50/60 border-amber-200'
                                : isSelected
                                ? 'bg-emerald-50/90 border-[#16A34A] ring-1 ring-[#16A34A]/30'
                                : 'bg-zinc-50 border-zinc-200 hover:bg-white'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-bold text-zinc-950 truncate flex items-center gap-1.5">
                                <span>{member.name}</span>
                                {isOccupied && (
                                  <span className="text-[9px] font-black uppercase text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                    Serving
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-zinc-500 truncate">
                                {member.role || staffRoleLabel}
                                {member.specialties ? ` • ${member.specialties}` : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span
                                className={`text-[10px] font-bold block ${
                                  isOccupied
                                    ? 'text-amber-700'
                                    : member.isAvailable !== false
                                    ? 'text-[#16A34A]'
                                    : 'text-zinc-400'
                                }`}
                              >
                                {isOccupied ? 'In Service' : member.isAvailable !== false ? 'Available' : 'Off-Duty'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Coupon Code Section */}
                <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs space-y-3">
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider">
                    Have a promo coupon?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. SERVEQ15"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs uppercase font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-zinc-50"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponCode}
                      className="px-4 py-2.5 bg-[#114227] hover:bg-[#0D361F] text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {validatingCoupon ? 'Validating...' : 'Apply'}
                    </button>
                  </div>
                  {appliedCoupon && (
                    <p className="text-xs text-[#16A34A] font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Coupon applied: -₹{appliedCoupon.discountAmount} saved!</span>
                    </p>
                  )}
                </div>

                {/* User's Existing Bookings at This Venue */}
                <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Your Bookings at {business.name}
                  </h3>
                  {myBookings.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-4 border border-dashed border-zinc-200 rounded-2xl">
                      No past or pending bookings here yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {myBookings.map((b) => (
                        <div
                          key={b._id}
                          className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-zinc-900">{formatTime(b.startTime)}</span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                b.status === 'completed'
                                  ? 'bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]'
                                  : b.status === 'serving'
                                  ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                                  : b.status === 'cancelled' || b.status === 'refunded'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-teal-100 text-teal-800'
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-800 font-bold leading-tight">{b.serviceType}</p>

                          {b.assignedStaff?.name && (
                            <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                              <User className="w-3 h-3 text-zinc-400" />
                              <span>{b.assignedStaff.name}</span>
                              <span className="text-[10px] text-zinc-400 font-normal">
                                ({b.assignedStaff.role || staffRoleLabel})
                              </span>
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-zinc-200/70">
                            <span className="font-bold text-emerald-800">Paid: ₹{b.paidAmount}</span>
                            <div>
                              {b.status === 'completed' ? (
                                <button
                                  onClick={() => handleOpenReview(b)}
                                  className="text-xs font-bold text-[#114227] hover:underline cursor-pointer"
                                >
                                  Leave Review
                                </button>
                              ) : b.status === 'scheduled' || b.status === 'confirmed' ? (
                                <button
                                  onClick={() => handleCancel(b._id)}
                                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                                >
                                  Cancel Booking
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT COLUMN: DATE & TIME SLOTS SELECTION ── */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs space-y-6">
                  {/* Date Selector Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                        Select Appointment Slot
                      </h2>
                      <p className="text-xs text-zinc-500 font-medium mt-0.5">
                        Choose your preferred date and verified time slot.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={selectedDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          setSelectedDate(e.target.value)
                          setLoading(true)
                        }}
                        className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* AI Safety Buffer Notice */}
                  {meta.aiBuffer > 0 && (
                    <div className="p-3 bg-[#EAF7EE] border border-[#BDE8CB] rounded-2xl text-xs text-[#114227] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
                      <span>
                        <strong>AI Pacing Active:</strong> +{meta.aiBuffer} mins safety buffer added based
                        on recent service completion velocity.
                      </span>
                    </div>
                  )}

                  {/* Venue Subscription Inactive Notice */}
                  {isSubscriptionInactive || business?.isSubscriptionActive === false ? (
                    <div className="py-12 px-6 text-center border border-amber-300 bg-amber-50/90 rounded-3xl space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
                        <Building className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-black text-amber-950">Appointments & Queue Paused</h3>
                        <p className="text-xs text-amber-800 max-w-md mx-auto leading-relaxed">
                          This venue does not currently have an active ServeQ subscription.
                          Online appointments and virtual live queue entries are temporarily unavailable.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/customers')}
                        className="px-5 py-2.5 bg-[#114227] text-white text-xs font-bold rounded-xl hover:bg-[#0D361F] transition-colors cursor-pointer shadow-xs"
                      >
                        Explore Other Verified Venues
                      </button>
                    </div>
                  ) : business?.bookingSettings?.enableAppointments === false ? (
                    <div className="py-12 px-6 text-center border border-amber-200 bg-amber-50 rounded-3xl space-y-3">
                      <h3 className="text-base font-bold text-amber-950">Advance Bookings Disabled</h3>
                      <p className="text-xs text-amber-800 max-w-md mx-auto">
                        This venue does not accept advance scheduled appointments. You can join their live
                        queue directly.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate(`/queue/${business._id}`)}
                        className="px-5 py-2.5 bg-[#114227] text-white text-xs font-bold rounded-xl hover:bg-[#0D361F] transition-colors"
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
                              className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-between min-h-[95px] ${
                                isAvailable
                                  ? 'bg-zinc-50/70 border-zinc-200 hover:border-[#16A34A] hover:bg-emerald-50/50 cursor-pointer shadow-2xs hover:scale-102'
                                  : 'bg-zinc-100/50 border-zinc-100 text-zinc-300 cursor-not-allowed opacity-60'
                              }`}
                            >
                              <span className="text-xs sm:text-sm font-black text-zinc-950">
                                {formatTime(slot.startTime)}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-bold">
                                {slot.duration || totalServiceDuration} mins
                              </span>
                              <span
                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md mt-1 ${
                                  isAvailable
                                    ? 'bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]'
                                    : 'bg-zinc-200 text-zinc-400'
                                }`}
                              >
                                {isAvailable ? 'Available' : 'Booked'}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      {slots.length === 0 && (
                        <div className="py-16 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-3xl text-xs space-y-2">
                          <p className="font-bold text-zinc-600 text-sm">No slots available on this date</p>
                          <p className="text-zinc-400">Please choose another day from the calendar picker above.</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Summary & Sticky Checkout Prompt */}
                  <div className="p-5 rounded-3xl bg-[#F4FAF6] border border-[#BDE8CB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        Booking Summary
                      </p>
                      <p className="font-black text-zinc-950 text-sm mt-0.5">
                        {selectedServices.map((s) => s.name).join(' + ')}
                      </p>
                      <p className="text-xs text-zinc-500 font-medium">
                        {totalServiceDuration} mins • {selectedStaff === 'any' ? 'On-duty auto staff' : selectedStaff?.name}
                      </p>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        Total Payable
                      </p>
                      <p className="text-lg font-black text-[#114227]">₹{finalPrice}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── PAYMENT CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {paymentModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-zinc-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="text-lg font-black text-zinc-950">Confirm Appointment</h3>
                  <p className="text-xs text-zinc-500">Order Summary & Payment Mode</p>
                </div>
                <button
                  onClick={() => setPaymentModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Order breakdown */}
              <div className="space-y-2.5 bg-zinc-50 p-4 rounded-2xl border border-zinc-100 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Venue</span>
                  <span className="font-bold text-zinc-950">{business?.name}</span>
                </div>

                <div className="space-y-1 py-1 border-t border-b border-zinc-200/60">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                    Services ({selectedServices.length})
                  </span>
                  {selectedServices.map((svc, i) => (
                    <div key={i} className="flex justify-between items-center text-zinc-800">
                      <span>• {svc.name} ({svc.duration}m)</span>
                      <span className="font-bold text-[#114227]">₹{svc.price}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-zinc-600">
                  <span>Assigned Specialist</span>
                  <span className="font-bold text-zinc-950">
                    {selectedStaff === 'any' ? 'On-Duty Specialist' : selectedStaff?.name}
                  </span>
                </div>

                <div className="flex justify-between text-zinc-600">
                  <span>Slot Time</span>
                  <span className="font-bold text-zinc-950">{formatTime(selectedSlot?.startTime)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#16A34A] font-bold">
                    <span>Coupon ({appliedCoupon?.coupon?.code})</span>
                    <span>-₹{discountAmount}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-200 flex justify-between text-sm font-black text-zinc-950">
                  <span>Total Payable</span>
                  <span className="text-[#114227]">₹{finalPrice}</span>
                </div>
              </div>

              {/* Payment Mode: Pay at Counter Only */}
              <div className="p-3.5 rounded-2xl border border-emerald-200 bg-[#EAF7EE]/70 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#114227] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <CreditCard className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#114227]">Pay at Counter</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-[#114227] font-semibold">
                      Cash / UPI / Card
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
                    Your appointment is confirmed immediately with zero advance charge. Settle ₹{finalPrice} directly at the venue counter upon arrival.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl border border-zinc-200 text-zinc-600 font-bold text-xs hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={bookingInProgress}
                  className="flex-1 py-3 rounded-2xl bg-[#114227] hover:bg-[#0D361F] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {bookingInProgress ? 'Reserving Slot...' : `Confirm Appointment (₹${finalPrice})`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── REVIEW MODAL ── */}
      <AnimatePresence>
        {reviewModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-zinc-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="text-lg font-black text-zinc-950">Leave a Verified Review</h3>
                  <p className="text-xs text-zinc-500">{business?.name}</p>
                </div>
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">Rating</label>
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
                            star <= rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-zinc-200 fill-zinc-200'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-zinc-600 ml-2">{rating} / 5 Stars</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                    Comments (Optional)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Share details of your experience..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full p-3.5 rounded-2xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-zinc-50"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-xs hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="flex-1 py-2.5 rounded-xl bg-[#114227] hover:bg-[#0D361F] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
