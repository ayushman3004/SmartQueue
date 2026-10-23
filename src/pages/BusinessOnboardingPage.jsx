import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  getOnboardingDraft,
  initOnboarding,
  saveOnboardingStep,
  launchBusiness,
  getMyBusinesses,
} from '../api/business.api'
import { CATEGORY_METADATA, SERVICE_PRESETS, STAFF_PRESETS, ALLOWED_CATEGORIES } from '../utils/servicePresets'
import { useSeo } from '../utils/useSeo'
import { sendEmailOtp, verifyEmailOtp } from '../api/auth.api'
import {
  ShieldAlert,
  Mail,
  Check,
  Loader2,
  Clock,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  CreditCard,
  Building2,
  Crown,
  Sparkles,
  Shield,
  LogOut,
} from 'lucide-react'
import { connectRouteAccount } from '../api/payment.api'
import SubscriptionPlansModal from '../components/SubscriptionPlansModal'
import {
  createSubscriptionOrder,
  verifySubscriptionPayment,
} from '../api/subscription.api'

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST +5:30)' },
  { value: 'UTC', label: 'UTC (+0:00)' },
  { value: 'America/New_York', label: 'America/New_York (EST -5:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT +0:00)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST +4:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT +8:00)' },
]

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const STEPS = [
  { id: 1, title: 'Business Info', subtitle: 'Profile & Category' },
  { id: 2, title: 'Location & Hours', subtitle: 'Address & Schedule' },
  { id: 3, title: 'Services', subtitle: 'Catalog & Pricing' },
  { id: 4, title: 'Staff Roster', subtitle: 'Team & Specialists' },
  { id: 5, title: 'Preferences', subtitle: 'Booking & Queues' },
  { id: 6, title: 'Payments', subtitle: 'Settlement & Modes' },
  { id: 7, title: 'Review & Launch', subtitle: 'Pre-flight & Go Live' },
]

const ONBOARDING_PLANS = [
  {
    id: 'BASIC',
    name: 'Basic Plan',
    price: 999,
    displayPrice: '₹999',
    period: '/ month',
    tagline: 'Essential virtual queue and scheduling foundation for standard venues.',
    badge: 'Starter',
    features: [
      'Standard Virtual Queue & Priority Counter Passes',
      'Appointment Booking & Slot Calendar',
      'Up to 3 Active Staff / Service Practitioners',
      'Counter Payments with Cash & UPI QR Tracking',
      'Automated SMS & Web Wait-Time Tracking',
      'Standard Footfall & Revenue Analytics',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro Plan',
    price: 1999,
    displayPrice: '₹1,999',
    period: '/ month',
    tagline: 'Advanced automation, instant online payments, and AI intelligence for high-traffic venues.',
    badge: 'Recommended',
    popular: true,
    features: [
      'Everything in Basic Plan, plus:',
      'Unlimited Staff Members & Practitioners',
      'Direct Online Razorpay Payments & Settlements',
      'AI Peak-Hour & Wait-Time Predictive Analytics',
      'Express VIP Queue Passes & Priority Slot Routing',
      'Multi-Service Sequencing & Combined Booking',
      'Dedicated 24/7 Priority Support & Venue Manager',
    ],
  },
]

export default function BusinessOnboardingPage() {
  const { user, setUser, logOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = () => {
    logOut()
    navigate('/login')
  }
  const { businessId: routeBizId } = useParams()
  const [searchParams] = useSearchParams()
  const targetBizId = routeBizId || searchParams.get('businessId')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [business, setBusiness] = useState(null)
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const [subscribingPlan, setSubscribingPlan] = useState(null)

  // Email verification check
  const isEmailVerified = Boolean(user?.isEmailVerified || user?.authProvider === 'google')

  // Inline OTP Verification state for unverified email gate
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtp, setEmailOtp] = useState('')
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false)
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)

  useEffect(() => {
    if (otpCooldown <= 0) return
    const timer = setInterval(() => setOtpCooldown((prev) => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [otpCooldown])

  const handleSendEmailOtp = async () => {
    if (!user?.email) {
      toast.error('No email address associated with your account')
      return
    }
    setSendingEmailOtp(true)
    try {
      const res = await sendEmailOtp(user.email)
      setEmailOtpSent(true)
      setOtpCooldown(30)
      toast.success(res.data?.message || `Verification OTP sent to ${user.email}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send verification code')
    } finally {
      setSendingEmailOtp(false)
    }
  }

  const handleVerifyEmailOtp = async (e) => {
    e?.preventDefault()
    const code = emailOtp.trim()
    if (!code || code.length < 6) {
      toast.error('Please enter the 6-digit OTP code')
      return
    }
    setVerifyingEmailOtp(true)
    try {
      const res = await verifyEmailOtp(user.email, code)
      if (res.data?.success || res.data?.data?.user) {
        const updated = res.data?.data?.user || { ...user, isEmailVerified: true }
        setUser(updated)
        toast.success('Email verified successfully! Please choose your subscription plan to begin onboarding.', { icon: '🎉' })
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP code')
    } finally {
      setVerifyingEmailOtp(false)
    }
  }

  // Handle plan subscription in onboarding step
  const handleSubscribeInOnboarding = async (plan) => {
    setSubscribingPlan(plan.id)
    try {
      const res = await createSubscriptionOrder(plan.id)
      const data = res.data.data
      const order = data.order || data
      const keyId = data.keyId || order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || localStorage.getItem('SERVEQ_RAZORPAY_KEY_ID')

      if (!keyId || keyId === 'rzp_test_placeholder') {
        setSubscriptionModalOpen(true)
        return
      }

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'ServeQ Platform Technologies',
        description: `${plan.name} Subscription (${plan.displayPrice}/mo)`,
        image: '/logo.png',
        ...(order?.id && !order.isMock && !order.id.startsWith('order_mock_') ? { order_id: order.id } : {}),
        handler: async (response) => {
          try {
            const verifyRes = await verifySubscriptionPayment({
              plan: plan.id,
              razorpayOrderId: response.razorpay_order_id || order.id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature || 'mock_signature_verified',
            })

            const updatedData = verifyRes.data.data
            if (setUser && updatedData.user) {
              setUser((prev) => ({
                ...prev,
                subscription: updatedData.subscription,
              }))
            }
            if (business) {
              setBusiness((b) => ({
                ...b,
                subscription: updatedData.subscription,
              }))
            }

            toast.success(`🎉 ${plan.name} activated! Unlocking Onboarding Studio...`, { duration: 5000 })
          } catch (vErr) {
            toast.error(vErr.response?.data?.message || 'Payment verification failed')
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#064E3B',
        },
        modal: {
          ondismiss: () => {
            toast('Payment cancelled', { icon: 'ℹ️' })
          },
        },
      }

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options)
        rzp.on('payment.failed', (errRes) => {
          toast.error(errRes.error?.description || 'Razorpay payment was not completed')
        })
        rzp.open()
      } else {
        setSubscriptionModalOpen(true)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start Razorpay checkout')
    } finally {
      setSubscribingPlan(null)
    }
  }

  useSeo({
    title: 'Venue Onboarding Wizard',
    description: 'Set up your venue profile, operating hours, and service catalog.',
    robots: 'noindex, nofollow',
  })

  // Step 1 Form: Business Information
  const [step1, setStep1] = useState({
    name: '',
    category: 'salon',
    description: '',
    email: '',
    phone: '',
    logo: '',
    coverImage: '',
  })

  // Step 2 Form: Location & Operating Hours
  const [step2, setStep2] = useState({
    country: 'India',
    state: '',
    city: '',
    postalCode: '',
    address: '',
    location: '',
    timezone: 'Asia/Kolkata',
    weeklySchedule: DAYS_OF_WEEK.map((d) => ({
      day: d,
      isOpen: d !== 'sunday',
      open: '09:00',
      close: '20:00',
    })),
    weeklyHolidays: ['sunday'],
  })

  // Step 3 Form: Services Catalog
  const [services, setServices] = useState([])
  const [newService, setNewService] = useState({
    name: '',
    duration: 30,
    price: 250,
    description: '',
    category: 'salon',
    isAvailable: true,
  })
  const [editingServiceIndex, setEditingServiceIndex] = useState(null)

  // Step 4 Form: Staff Roster
  const [staff, setStaff] = useState([])
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: '',
    specialties: '',
    phone: '',
    description: '',
    profileImage: '',
    isAvailable: true,
  })
  const [editingStaffIndex, setEditingStaffIndex] = useState(null)

  // Step 5 Form: Booking & Queue Preferences
  const [preferences, setPreferences] = useState({
    bookingSettings: {
      enableAppointments: true,
      allowStaffSelection: true,
      allowSameDayBooking: true,
      maxAdvanceBookingDays: 14,
      cancellationWindowHours: 2,
      bufferTimeBetweenAppointments: 15,
    },
    queueSettings: {
      enableLiveQueue: true,
      allowWalkIns: true,
      queueOpeningTime: '09:00',
      queueClosingTime: '20:00',
      maxQueueCapacity: 30,
    },
  })

  // Step 6 Form: Payment Configuration
  const [paymentConfig, setPaymentConfig] = useState({
    paymentMode: 'PAY_AT_BUSINESS',
    onlinePaymentStatus: 'NOT_STARTED',
    paymentProvider: 'razorpay',
    providerAccountReference: '',
    upiId: '',
  })
  const [routeForm, setRouteForm] = useState({
    legalBusinessName: '',
    businessType: 'individual',
    providerAccountReference: '',
  })
  const [connectingRoute, setConnectingRoute] = useState(false)

  // Sync state from loaded business
  const populateFromBusiness = useCallback((biz) => {
    if (!biz) return
    setBusiness(biz)

    // Step 1
    setStep1({
      name: biz.name || '',
      category: biz.category || 'salon',
      description: biz.description || '',
      email: biz.email || '',
      phone: biz.phone || '',
      logo: biz.logo || '',
      coverImage: biz.coverImage || '',
    })

    // Step 2
    const schedule = (biz.operatingHours?.weeklySchedule && biz.operatingHours.weeklySchedule.length > 0)
      ? biz.operatingHours.weeklySchedule
      : DAYS_OF_WEEK.map((d) => ({
          day: d,
          isOpen: d !== 'sunday',
          open: biz.timings?.open || '09:00',
          close: biz.timings?.close || '20:00',
        }))

    setStep2({
      country: biz.locationDetails?.country || 'India',
      state: biz.locationDetails?.state || '',
      city: biz.locationDetails?.city || '',
      postalCode: biz.locationDetails?.postalCode || '',
      address: biz.address || '',
      location: biz.location || '',
      timezone: biz.operatingHours?.timezone || 'Asia/Kolkata',
      weeklySchedule: schedule,
      weeklyHolidays: biz.operatingHours?.weeklyHolidays || ['sunday'],
    })

    // Step 3
    setServices(biz.services && biz.services.length > 0 ? biz.services : [])

    // Step 4
    setStaff(biz.staff && biz.staff.length > 0 ? biz.staff : [])

    // Step 5
    setPreferences({
      bookingSettings: {
        enableAppointments: biz.bookingSettings?.enableAppointments !== false,
        allowStaffSelection: biz.bookingSettings?.allowStaffSelection !== false,
        allowSameDayBooking: biz.bookingSettings?.allowSameDayBooking !== false,
        maxAdvanceBookingDays: biz.bookingSettings?.maxAdvanceBookingDays || 14,
        cancellationWindowHours: biz.bookingSettings?.cancellationWindowHours || 2,
        bufferTimeBetweenAppointments: biz.bookingSettings?.bufferTimeBetweenAppointments || 15,
      },
      queueSettings: {
        enableLiveQueue: biz.queueSettings?.enableLiveQueue !== false,
        allowWalkIns: biz.queueSettings?.allowWalkIns !== false,
        queueOpeningTime: biz.queueSettings?.queueOpeningTime || '09:00',
        queueClosingTime: biz.queueSettings?.queueClosingTime || '20:00',
        maxQueueCapacity: biz.queueSettings?.maxQueueCapacity || 30,
      },
    })

    // Step 6
    setPaymentConfig({
      paymentMode: biz.paymentConfiguration?.paymentMode || 'PAY_AT_BUSINESS',
      onlinePaymentStatus: biz.paymentConfiguration?.onlinePaymentStatus || 'NOT_STARTED',
      paymentProvider: biz.paymentConfiguration?.paymentProvider || 'razorpay',
      providerAccountReference: biz.paymentConfiguration?.providerAccountReference || '',
      upiId: biz.paymentConfiguration?.upiId || '',
    })
    setRouteForm({
      legalBusinessName: biz.paymentConfiguration?.legalBusinessName || biz.name || '',
      businessType: biz.paymentConfiguration?.businessType || 'individual',
      providerAccountReference: biz.paymentConfiguration?.providerAccountReference || '',
    })

    // Current step
    if (biz.onboarding?.currentStep) {
      setCurrentStep(Math.min(7, Math.max(1, biz.onboarding.currentStep)))
    }
  }, [])

  // Initial Load / Recovery
  useEffect(() => {
    let isMounted = true
    if (!isEmailVerified) {
      setLoading(false)
      return
    }

    const init = async () => {
      setLoading(true)
      try {
        let biz = null
        if (targetBizId) {
          const res = await getOnboardingDraft(targetBizId)
          biz = res.data.data.business
        } else {
          // Check if there is an in-progress draft
          const res = await getOnboardingDraft()
          biz = res.data.data.business
          if (!biz) {
            // Check if user already has an active business; if so, load it
            const myRes = await getMyBusinesses()
            const hubs = myRes.data.data.businesses || []
            if (hubs.length > 0) {
              const unfinished = hubs.find((h) => h.onboarding?.status === 'IN_PROGRESS')
              if (unfinished) {
                biz = unfinished
              } else {
                // If all businesses completed, initialize new draft
                const initRes = await initOnboarding({ name: `${user?.name || 'My'}'s Hub` })
                biz = initRes.data.data.business
              }
            } else {
              // Initialize fresh onboarding
              const initRes = await initOnboarding({ name: `${user?.name || 'My'}'s Hub` })
              biz = initRes.data.data.business
            }
          }
        }

        if (isMounted && biz) {
          populateFromBusiness(biz)
        }
      } catch (err) {
        console.error('Failed to initialize onboarding draft:', err)
        toast.error('Could not load onboarding draft. Creating a new session...')
        try {
          const fallbackRes = await initOnboarding({ name: `${user?.name || 'My'}'s Hub`, createNew: true })
          if (isMounted) populateFromBusiness(fallbackRes.data.data.business)
        } catch {
          toast.error('Initialization error. Please refresh.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    init()
    return () => { isMounted = false }
  }, [targetBizId, populateFromBusiness, user?.name, isEmailVerified])

  // Helper for image upload preview (data URL or external URL)
  const handleImageFile = (e, field) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      toast.error('Only JPG, PNG, and WebP images are supported')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be under 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target.result
      setStep1((prev) => ({ ...prev, [field]: result }))
      toast.success(`${field === 'logo' ? 'Logo' : 'Cover image'} updated!`)
    }
    reader.readAsDataURL(file)
  }

  // Handle Category Switch with preset assistance
  const handleCategorySwitch = (newCat) => {
    setStep1((prev) => ({ ...prev, category: newCat }))
    if (services.length === 0) {
      const presets = SERVICE_PRESETS[newCat] || []
      setServices(presets.map((p) => ({ ...p, isAvailable: true, description: '' })))
    }
    if (staff.length === 0) {
      const staffPreset = STAFF_PRESETS[newCat]?.defaults || []
      setStaff(staffPreset.map((s) => ({ ...s, isAvailable: true })))
    }
  }

  // Step 2 Schedule Toggle
  const toggleDaySchedule = (dayIndex) => {
    setStep2((prev) => {
      const updated = [...prev.weeklySchedule]
      updated[dayIndex] = {
        ...updated[dayIndex],
        isOpen: !updated[dayIndex].isOpen,
      }
      return { ...prev, weeklySchedule: updated }
    })
  }

  const updateDayTiming = (dayIndex, field, value) => {
    setStep2((prev) => {
      const updated = [...prev.weeklySchedule]
      updated[dayIndex] = {
        ...updated[dayIndex],
        [field]: value,
      }
      return { ...prev, weeklySchedule: updated }
    })
  }

  // Step 3 Service Actions
  const handleAddService = () => {
    if (!newService.name.trim()) {
      toast.error('Please enter a service name')
      return
    }
    const duration = Math.max(1, Number(newService.duration) || 15)
    const price = Math.max(0, Number(newService.price) || 0)

    if (editingServiceIndex !== null) {
      const updated = [...services]
      updated[editingServiceIndex] = {
        ...newService,
        name: newService.name.trim(),
        duration,
        price,
      }
      setServices(updated)
      setEditingServiceIndex(null)
      toast.success(`Service "${newService.name.trim()}" updated!`)
    } else {
      setServices((prev) => [
        ...prev,
        {
          ...newService,
          name: newService.name.trim(),
          duration,
          price,
        },
      ])
      toast.success(`Service "${newService.name.trim()}" added to catalog!`)
    }

    setNewService({
      name: '',
      duration: 30,
      price: 250,
      description: '',
      category: step1.category,
      isAvailable: true,
    })
  }

  const handleEditService = (idx) => {
    setEditingServiceIndex(idx)
    setNewService({ ...services[idx] })
  }

  const handleDeleteService = (idx) => {
    if (services.length <= 1) {
      toast.error('A business must offer at least one active service')
      return
    }
    setServices((prev) => prev.filter((_, i) => i !== idx))
    if (editingServiceIndex === idx) setEditingServiceIndex(null)
  }

  const handleLoadServicePresets = () => {
    const presets = SERVICE_PRESETS[step1.category] || SERVICE_PRESETS.salon
    setServices(presets.map((p) => ({ ...p, isAvailable: true, description: '' })))
    toast.success(`Loaded standard ${step1.category} services!`)
  }

  // Step 4 Staff Actions
  const handleAddStaff = () => {
    if (!newStaff.name.trim()) {
      toast.error('Please enter a staff member name')
      return
    }
    const defaultRole = step1.category === 'clinic' ? 'Consultant Doctor' : 'Barber / Stylist'

    if (editingStaffIndex !== null) {
      const updated = [...staff]
      updated[editingStaffIndex] = {
        ...newStaff,
        name: newStaff.name.trim(),
        role: newStaff.role.trim() || defaultRole,
      }
      setStaff(updated)
      setEditingStaffIndex(null)
      toast.success(`Staff member "${newStaff.name.trim()}" updated!`)
    } else {
      setStaff((prev) => [
        ...prev,
        {
          ...newStaff,
          name: newStaff.name.trim(),
          role: newStaff.role.trim() || defaultRole,
          rating: 5.0,
          customersServed: 0,
        },
      ])
      toast.success(`Staff member "${newStaff.name.trim()}" added to roster!`)
    }

    setNewStaff({
      name: '',
      role: '',
      specialties: '',
      phone: '',
      description: '',
      profileImage: '',
      isAvailable: true,
    })
  }

  const handleEditStaff = (idx) => {
    setEditingStaffIndex(idx)
    setNewStaff({ ...staff[idx] })
  }

  const handleDeleteStaff = (idx) => {
    setStaff((prev) => prev.filter((_, i) => i !== idx))
    if (editingStaffIndex === idx) setEditingStaffIndex(null)
  }

  const handleLoadStaffPresets = () => {
    const isClinic = step1.category === 'clinic' || step1.category === 'healthcare'
    const presets = STAFF_PRESETS[isClinic ? 'clinic' : 'salon']?.defaults || []
    setStaff(presets.map((s) => ({ ...s, isAvailable: true })))
    toast.success(`Loaded recommended staff team!`)
  }

  // Save Step Action (Autosaves to MongoDB)
  const handleSaveStep = async (stepNum, advance = true) => {
    if (!business?._id) return

    setSaving(true)
    try {
      let payload = {}

      if (stepNum === 1) {
        if (!step1.name.trim()) {
          toast.error('Business Name is required')
          setSaving(false)
          return
        }
        payload = {
          name: step1.name.trim(),
          category: step1.category,
          description: step1.description.trim(),
          email: step1.email.trim(),
          phone: step1.phone.trim(),
          logo: step1.logo,
          coverImage: step1.coverImage,
        }
      } else if (stepNum === 2) {
        if (!step2.address.trim() && !step2.city.trim() && !step2.location.trim()) {
          toast.error('Please enter an address or city for your venue')
          setSaving(false)
          return
        }
        for (const s of step2.weeklySchedule) {
          if (s.isOpen && s.open && s.close && s.open >= s.close) {
            toast.error(`Closing time (${s.close}) must be after opening time (${s.open}) on ${s.day}`)
            setSaving(false)
            return
          }
        }
        payload = {
          address: step2.address.trim(),
          location: step2.location.trim() || step2.city.trim(),
          country: step2.country,
          state: step2.state,
          city: step2.city,
          postalCode: step2.postalCode,
          timezone: step2.timezone,
          weeklySchedule: step2.weeklySchedule,
          weeklyHolidays: step2.weeklySchedule.filter((s) => !s.isOpen).map((s) => s.day),
        }
      } else if (stepNum === 3) {
        if (services.length === 0) {
          toast.error('You must add at least one service to your catalog')
          setSaving(false)
          return
        }
        payload = { services }
      } else if (stepNum === 4) {
        payload = { staff }
      } else if (stepNum === 5) {
        payload = {
          bookingSettings: preferences.bookingSettings,
          queueSettings: preferences.queueSettings,
        }
      } else if (stepNum === 6) {
        payload = {
          paymentMode: paymentConfig.paymentMode,
          onlinePaymentStatus: paymentConfig.onlinePaymentStatus,
          paymentProvider: paymentConfig.paymentProvider,
          providerAccountReference: paymentConfig.providerAccountReference,
          upiId: paymentConfig.upiId,
        }
      }

      const res = await saveOnboardingStep(business._id, stepNum, payload)
      setBusiness(res.data.data.business)
      toast.success(`Step ${stepNum} saved successfully!`)

      if (advance && stepNum < 7) {
        setCurrentStep(stepNum + 1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to save Step ${stepNum}`)
    } finally {
      setSaving(false)
    }
  }

  // Step 7: Launch Business
  const handleLaunch = async () => {
    if (!business?._id) return

    if (user?.subscription?.status !== 'ACTIVE' && business?.subscription?.status !== 'ACTIVE') {
      toast.error('An active ServeQ subscription (Basic ₹999 or Pro ₹1,999) is required to launch your business.', {
        duration: 5000,
      })
      setSubscriptionModalOpen(true)
      return
    }

    setSaving(true)
    try {
      const res = await launchBusiness(business._id)
      const launched = res.data.data.business
      setBusiness(launched)
      toast.success('Your business is ready on ServeQ!', {
        duration: 6000,
        style: {
          borderRadius: '16px',
          background: '#09090b',
          color: '#ffffff',
          border: '1px solid #14b8a6',
          padding: '16px',
          fontWeight: 'bold',
        },
      })
      navigate('/business')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Pre-flight launch validation failed')
    } finally {
      setSaving(false)
    }
  }

  // Block onboarding if email is unverified
  if (!isEmailVerified) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/75 backdrop-blur-md p-4 selection:bg-emerald-500/20 selection:text-emerald-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-zinc-200 text-center space-y-6 text-zinc-900"
        >
          {/* Header Icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="w-8 h-8 text-amber-700" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 inline-block">
              Email Verification Required
            </span>
            <h2 className="text-2xl font-black text-zinc-950 tracking-tight">
              Verify Email to Onboard Your Hub
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed max-w-md mx-auto">
              To publish and operate business venues on ServeQ, business owners must verify their registered email (<span className="text-zinc-900 font-bold">{user?.email}</span>) with an OTP.
            </p>
          </div>

          {/* OTP Box */}
          <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-left space-y-4">
            {!emailOtpSent ? (
              <div className="text-center space-y-3">
                <p className="text-xs text-zinc-600 font-medium">
                  Click below to receive a 6-digit one-time passcode on <span className="font-bold text-zinc-900">{user?.email}</span>.
                </p>
                <button
                  type="button"
                  disabled={sendingEmailOtp}
                  onClick={handleSendEmailOtp}
                  className="w-full py-3 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {sendingEmailOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Passcode...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send 6-Digit OTP</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
                <div className="space-y-1.5 text-center">
                  <label className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
                    Enter Verification Passcode
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="• • • • • •"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-48 mx-auto px-4 py-2.5 text-center text-xl font-black tracking-widest bg-white border-2 border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-zinc-900 shadow-2xs block"
                  />
                  <p className="text-[11px] text-zinc-500 font-medium mt-1">
                    Passcode delivered to <strong className="text-zinc-800">{user?.email}</strong>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={verifyingEmailOtp || emailOtp.length < 6}
                  className="w-full py-3 px-5 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {verifyingEmailOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Verify & Unlock Studio</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 text-xs pt-1">
                  {otpCooldown > 0 ? (
                    <span className="text-zinc-500 font-semibold text-[11px] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Resend code in {otpCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={sendingEmailOtp}
                      onClick={handleSendEmailOtp}
                      className="text-amber-800 hover:text-amber-950 font-bold underline text-xs cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Resend Passcode</span>
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Navigation alternatives */}
          <div className="flex items-center justify-center gap-4 text-xs font-bold pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="text-zinc-600 hover:text-zinc-950 underline cursor-pointer"
            >
              Profile Settings
            </button>
            <span className="text-zinc-300">•</span>
            <button
              type="button"
              onClick={() => navigate('/business')}
              className="text-zinc-600 hover:text-zinc-950 underline cursor-pointer"
            >
              Return to Hub Console
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  const isSubscribed = Boolean(
    user?.subscription?.status === 'ACTIVE' &&
    user?.subscription?.plan &&
    user?.subscription?.plan !== 'NONE'
  )

  // Block onboarding until subscription is chosen and paid via Razorpay
  if (!isSubscribed) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/75 backdrop-blur-md p-3 sm:p-6 overflow-y-auto selection:bg-emerald-500/20 selection:text-emerald-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden my-auto text-zinc-900"
        >
          {/* Header */}
          <div className="p-6 sm:p-8 bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#064E3B] text-white relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" />

            {/* Stepper Progress & Sign Out */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="flex items-center gap-1 text-emerald-300 bg-white/10 px-2.5 py-0.5 rounded-full">
                  <Check className="w-3.5 h-3.5" /> 1. Email Verified
                </span>
                <span className="text-emerald-300/60">→</span>
                <span className="bg-white/20 px-3 py-0.5 rounded-full text-white border border-white/30 shadow-xs flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-300" />
                  <span>2. Choose Plan & Pay (Current)</span>
                </span>
                <span className="text-emerald-300/60">→</span>
                <span className="text-emerald-200/60 px-2 py-0.5">
                  3. Onboard & Access Dashboard
                </span>
              </div>

              {/* Sign Out Button in Header */}
              <button
                type="button"
                onClick={handleSignOut}
                className="self-end sm:self-auto px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-rose-500/25 text-white hover:text-rose-100 border border-white/25 hover:border-rose-300/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Sign out of your account"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-300" />
                <span>Sign Out</span>
              </button>
            </div>

            <div className="space-y-2 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-[11px] font-bold text-emerald-100 uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5 text-amber-300" />
                <span>ServeQ Venue Platform Subscription</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Choose Your Plan to Start Onboarding
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 font-medium max-w-2xl leading-relaxed">
                Every business on ServeQ requires an active plan to configure live queues, staff rosters, and take customer bookings. Choose your subscription to unlock the Onboarding Studio and launch your venue.
              </p>
            </div>
          </div>

          {/* Cards Body */}
          <div className="p-6 sm:p-8 bg-zinc-50/70 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ONBOARDING_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all ${
                    plan.popular
                      ? 'bg-white border-2 border-emerald-600 shadow-xl ring-4 ring-emerald-500/10'
                      : 'bg-white border border-zinc-200 shadow-sm hover:border-zinc-300'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 right-6 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-black text-zinc-950">{plan.name}</h3>
                      {!plan.popular && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                          {plan.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-500 min-h-[34px] leading-relaxed">
                      {plan.tagline}
                    </p>

                    <div className="my-5 pb-5 border-b border-zinc-100 flex items-baseline gap-1.5">
                      <span className="text-4xl sm:text-5xl font-black text-zinc-950 tracking-tight">
                        {plan.displayPrice}
                      </span>
                      <span className="text-xs font-bold text-zinc-400">
                        {plan.period}
                      </span>
                    </div>

                    <div className="space-y-3 mb-6">
                      <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                        Included Features
                      </p>
                      <ul className="space-y-2.5">
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-700">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              plan.popular ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700'
                            }`}>
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                            <span className="leading-tight">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!!subscribingPlan}
                    onClick={() => handleSubscribeInOnboarding(plan)}
                    className={`w-full py-3.5 px-4 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                      plan.popular
                        ? 'bg-[#064E3B] hover:bg-[#047857] text-white active:scale-98'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-white active:scale-98'
                    }`}
                  >
                    {subscribingPlan === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Opening Razorpay Checkout...</span>
                      </>
                    ) : (
                      <>
                        <span>Pay {plan.displayPrice} via Razorpay</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Bottom Security Assurance & Account Sign Out */}
            <div className="mt-6 pt-5 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-3">
              <div className="flex items-center gap-2 font-medium">
                <Shield className="w-4 h-4 text-emerald-700" />
                <span>
                  Direct ServeQ Razorpay Settlement &bull; 256-Bit SSL Encryption
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400">Signed in as <strong>{user?.email}</strong></span>
                <span className="text-zinc-300">•</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen app-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-600 font-bold text-xs uppercase tracking-widest">
            Preparing Onboarding Studio...
          </p>
        </div>
      </div>
    )
  }

  const completedSet = new Set(business?.onboarding?.completedSteps || [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/75 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-hidden selection:bg-teal-500/20 selection:text-teal-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full h-full max-w-6xl max-h-[96vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200/90 relative text-left"
      >
        {/* Modal Top Header */}
        <div className="flex-shrink-0 bg-white border-b border-zinc-200/80 px-6 py-4 grid grid-cols-3 items-center">
          {/* Left: Step indicator */}
          <div className="text-left">
            <span className="text-xs text-zinc-500 font-medium">
              Step {currentStep} of {STEPS.length}: <strong className="text-zinc-900">{STEPS[currentStep - 1]?.title}</strong>
            </span>
          </div>

          {/* Center: serveQ Brand in Middle, NO LOGO */}
          <div className="text-center flex flex-col items-center justify-center">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-zinc-950 tracking-tight leading-none">serveQ</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/70">
                Onboarding Studio
              </span>
            </div>
          </div>

          {/* Right Action */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/business')}
              className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 text-xs font-bold transition-all flex items-center gap-1.5"
              title="Save progress and exit to dashboard"
            >
              <span>Save & Close</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-rose-50 hover:border-rose-200 text-zinc-600 hover:text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Sign out of ServeQ"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Modal Progress Stepper Bar: Line & Circle Stepper */}
        <div className="flex-shrink-0 bg-white border-b border-zinc-200/80 px-6 sm:px-12 py-5 overflow-x-auto">
          <div className="flex items-start justify-between min-w-[760px]">
            {STEPS.map((s, index) => {
              const isCompleted = completedSet.has(s.id)
              const isCurrent = currentStep === s.id
              const isAccessible = isCompleted || s.id <= (business?.onboarding?.currentStep || 1)
              const isLast = index === STEPS.length - 1

              return (
                <div key={s.id} className="flex-1 flex items-start last:flex-none">
                  {/* Step Item with Circle and Label */}
                  <button
                    type="button"
                    disabled={!isAccessible}
                    onClick={() => setCurrentStep(s.id)}
                    className={`flex flex-col items-center group relative z-10 focus:outline-none transition-all ${
                      isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                    }`}
                  >
                    {/* Circle Node */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        isCompleted
                          ? 'bg-teal-600 text-white shadow-sm ring-4 ring-teal-50'
                          : isCurrent
                          ? 'bg-white border-2 border-teal-600 text-teal-700 font-extrabold ring-4 ring-teal-100 shadow-xs'
                          : isAccessible
                          ? 'bg-white border-2 border-zinc-300 text-zinc-600 hover:border-zinc-400'
                          : 'bg-zinc-100 border-2 border-zinc-200 text-zinc-400'
                      }`}
                    >
                      {isCompleted ? (
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span>{s.id}</span>
                      )}
                    </div>

                    {/* Step Label below circle */}
                    <div className="text-center mt-2 px-1">
                      <p
                        className={`text-xs font-bold whitespace-nowrap tracking-tight ${
                          isCurrent
                            ? 'text-teal-700'
                            : isCompleted
                            ? 'text-zinc-900 font-semibold'
                            : 'text-zinc-500'
                        }`}
                      >
                        {s.title}
                      </p>
                      <p
                        className={`text-[10px] whitespace-nowrap mt-0.5 ${
                          isCurrent
                            ? 'text-teal-600 font-medium'
                            : isCompleted
                            ? 'text-zinc-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {s.subtitle}
                      </p>
                    </div>
                  </button>

                  {/* Connecting Line to next step */}
                  {!isLast && (
                    <div className="flex-1 px-2 pt-4">
                      <div
                        className={`h-0.5 w-full transition-colors ${
                          completedSet.has(s.id) ? 'bg-teal-600' : 'bg-zinc-200'
                        }`}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Scrollable Dynamic Wizard Step Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white">
          
          {/* STEP 1: BUSINESS INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-6 text-left">
              <div>
                <span className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Step 01 &bull; Identity</span>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
                  Tell us about your business
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1">
                  This core profile information will represent your venue across ServeQ discovery, queues, and appointments.
                </p>
              </div>

              {/* Category Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 block">
                  Select Business Category *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ALLOWED_CATEGORIES.map((cat) => {
                    const meta = CATEGORY_METADATA[cat] || {}
                    const isSelected = step1.category === cat
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategorySwitch(cat)}
                        className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-zinc-100'
                        }`}
                      >
                        <span className="text-xs font-bold uppercase tracking-wider">{meta.label || cat}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Business / Venue Name *</label>
                  <input
                    type="text"
                    required
                    value={step1.name}
                    onChange={(e) => setStep1({ ...step1, name: e.target.value })}
                    placeholder="e.g. Blade & Shears Executive Barbershop"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Official Contact Email</label>
                  <input
                    type="email"
                    value={step1.email}
                    onChange={(e) => setStep1({ ...step1, email: e.target.value })}
                    placeholder="contact@yourbusiness.com"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Customer Helpline Phone</label>
                  <input
                    type="text"
                    value={step1.phone}
                    onChange={(e) => setStep1({ ...step1, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Brief Overview / Description</label>
                  <textarea
                    rows={3}
                    value={step1.description}
                    onChange={(e) => setStep1({ ...step1, description: e.target.value })}
                    placeholder="Premium salon experience offering tailored cuts, beard styling, and revitalizing hot towel treatments."
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>

                {/* Logo & Cover Images */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 block">Business Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center overflow-hidden flex-shrink-0 text-zinc-400">
                      {step1.logo ? (
                        <img src={step1.logo} alt="Logo preview" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="space-y-1 flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFile(e, 'logo')}
                        className="text-xs text-zinc-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                      />
                      <p className="text-[10px] text-zinc-400">Max 2MB (PNG, JPG, WebP)</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 block">Venue Cover Banner</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center overflow-hidden flex-shrink-0 text-zinc-400">
                      {step1.coverImage ? (
                        <img src={step1.coverImage} alt="Cover preview" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="space-y-1 flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFile(e, 'coverImage')}
                        className="text-xs text-zinc-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                      />
                      <p className="text-[10px] text-zinc-400">Max 2MB banner image</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Controls */}
              <div className="pt-6 border-t border-zinc-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveStep(1, true)}
                  className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 active:scale-98"
                >
                  {saving ? 'Saving...' : 'Save & Continue to Location →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: LOCATION & OPERATING HOURS */}
          {currentStep === 2 && (
            <div className="space-y-6 text-left">
              <div>
                <span className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Step 02 &bull; Presence</span>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
                  Location & Operating Hours
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1">
                  Configure where patrons find your venue and when counters and appointment slots operate.
                </p>
              </div>

              {/* Address Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2 lg:col-span-4 space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Complete Physical Address *</label>
                  <input
                    type="text"
                    required
                    value={step2.address}
                    onChange={(e) => setStep2({ ...step2, address: e.target.value })}
                    placeholder="Shop 14, Ground Floor, Orion Hub, 80ft Road"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Area / Neighborhood</label>
                  <input
                    type="text"
                    value={step2.location}
                    onChange={(e) => setStep2({ ...step2, location: e.target.value })}
                    placeholder="Indiranagar"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">City</label>
                  <input
                    type="text"
                    value={step2.city}
                    onChange={(e) => setStep2({ ...step2, city: e.target.value })}
                    placeholder="Bangalore"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">State / Region</label>
                  <input
                    type="text"
                    value={step2.state}
                    onChange={(e) => setStep2({ ...step2, state: e.target.value })}
                    placeholder="Karnataka"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Postal / ZIP Code</label>
                  <input
                    type="text"
                    value={step2.postalCode}
                    onChange={(e) => setStep2({ ...step2, postalCode: e.target.value })}
                    placeholder="560038"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Venue Timezone</label>
                  <select
                    value={step2.timezone}
                    onChange={(e) => setStep2({ ...step2, timezone: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none focus:border-teal-600 font-medium"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Weekly Operating Hours Schedule */}
              <div className="space-y-3 pt-4 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                    Weekly Operating Hours & Shifts
                  </h3>
                  <span className="text-xs text-zinc-500 font-medium">Customize hours per day</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {step2.weeklySchedule.map((item, idx) => (
                    <div
                      key={item.day}
                      className={`p-4 rounded-2xl border transition-all ${
                        item.isOpen
                          ? 'bg-zinc-50/80 border-zinc-200 shadow-2xs'
                          : 'bg-zinc-100/60 border-zinc-200/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase text-zinc-900 tracking-wider">
                          {item.day}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleDaySchedule(idx)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                            item.isOpen
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}
                        >
                          {item.isOpen ? 'Open' : 'Closed'}
                        </button>
                      </div>

                      {item.isOpen ? (
                        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                          <div>
                            <span className="text-[10px] text-zinc-400 font-bold block mb-1">Open</span>
                            <input
                              type="time"
                              value={item.open}
                              onChange={(e) => updateDayTiming(idx, 'open', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 bg-white font-semibold text-xs focus:outline-none focus:border-teal-600"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-400 font-bold block mb-1">Close</span>
                            <input
                              type="time"
                              value={item.close}
                              onChange={(e) => updateDayTiming(idx, 'close', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 bg-white font-semibold text-xs focus:outline-none focus:border-teal-600"
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic pt-1">Weekly rest day / holiday</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Action Controls */}
              <div className="pt-6 border-t border-zinc-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-3 rounded-2xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  ← Back to Business Info
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveStep(2, true)}
                  className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 active:scale-98"
                >
                  {saving ? 'Saving...' : 'Save & Continue to Services →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SERVICES CATALOG */}
          {currentStep === 3 && (
            <div className="space-y-6 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Step 03 &bull; Offerings</span>
                  <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
                    Services Catalog ({services.length})
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1">
                    Define the menu of services, target durations, and pricing that patrons can select.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadServicePresets}
                  className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3.5 py-2 rounded-xl hover:bg-teal-100 transition-all self-start sm:self-auto flex items-center gap-1.5"
                >
                  Load Industry Presets
                </button>
              </div>

              {/* Existing Services List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                  Configured Services ({services.length})
                </h4>
                {services.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
                    <p className="text-xs text-zinc-400 font-medium">No services added yet. Add your first service below or click "Load Industry Presets".</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {services.map((svc, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3 shadow-2xs hover:border-zinc-300 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-black text-zinc-950 truncate">{svc.name}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 font-semibold">
                            <span className="px-2 py-0.5 rounded-md bg-zinc-200/70 text-zinc-700 text-[10px]">
                              {svc.duration} mins
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-extrabold text-[10px]">
                              ₹{svc.price}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditService(idx)}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-700 text-xs font-bold hover:bg-zinc-100 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteService(idx)}
                            className="w-7 h-7 rounded-xl text-rose-500 hover:bg-rose-50 flex items-center justify-center font-bold text-xs transition-colors"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add / Edit Inline Sub-Form */}
              <div className="p-5 rounded-2xl border border-dashed border-teal-300/80 bg-teal-50/40 space-y-3">
                <span className="text-xs font-black uppercase text-teal-800 tracking-wider block">
                  {editingServiceIndex !== null ? 'Edit Service' : '+ Add New Service'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      placeholder="Service Name (e.g. Master Fade Cut)"
                      value={newService.name}
                      onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        placeholder="Duration"
                        value={newService.duration}
                        onChange={(e) => setNewService({ ...newService, duration: Number(e.target.value) })}
                        className="w-full pl-3.5 pr-8 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">min</span>
                    </div>
                  </div>
                  <div className="sm:col-span-3">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        placeholder="Price"
                        value={newService.price}
                        onChange={(e) => setNewService({ ...newService, price: Number(e.target.value) })}
                        className="w-full pl-6 pr-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">₹</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xs"
                  >
                    {editingServiceIndex !== null ? 'Save Changes' : '+ Add Service'}
                  </button>
                  {editingServiceIndex !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingServiceIndex(null)
                        setNewService({ name: '', duration: 30, price: 250, description: '', category: step1.category, isAvailable: true })
                      }}
                      className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="pt-6 border-t border-zinc-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-3 rounded-2xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  ← Back to Location
                </button>
                <button
                  type="button"
                  disabled={saving || services.length === 0}
                  onClick={() => handleSaveStep(3, true)}
                  className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 active:scale-98 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save & Continue to Staff →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: STAFF MANAGEMENT */}
          {currentStep === 4 && (
            <div className="space-y-6 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Step 04 &bull; Practitioners</span>
                  <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
                    {step1.category === 'clinic' ? 'Doctors & Medical Specialists' : 'Barbers & Master Stylists'} ({staff.length})
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1">
                    Configure staff members that can be selected by patrons or auto-assigned during check-in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadStaffPresets}
                  className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3.5 py-2 rounded-xl hover:bg-teal-100 transition-all self-start sm:self-auto flex items-center gap-1.5"
                >
                  Load Recommended Team
                </button>
              </div>

              {/* Staff List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                  Active Team Roster ({staff.length})
                </h4>
                {staff.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50 space-y-2">
                    <p className="text-xs text-zinc-500 font-medium">No team members registered yet. Add staff below or click "Load Recommended Team".</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {staff.map((st, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3 shadow-2xs hover:border-zinc-300 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-teal-100/70 text-teal-900 border border-teal-200 flex items-center justify-center font-black text-sm flex-shrink-0">
                            {st.name?.slice(0, 2).toUpperCase() || 'ST'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-zinc-950 truncate">{st.name}</p>
                            <p className="text-xs text-teal-700 font-semibold truncate">{st.role || 'Practitioner'}</p>
                            {st.specialties && (
                              <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                                {Array.isArray(st.specialties) ? st.specialties.join(', ') : st.specialties}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditStaff(idx)}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-700 text-xs font-bold hover:bg-zinc-100 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(idx)}
                            className="w-7 h-7 rounded-xl text-rose-500 hover:bg-rose-50 flex items-center justify-center font-bold text-xs transition-colors"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add / Edit Staff Form */}
              <div className="p-5 rounded-2xl border border-dashed border-teal-300/80 bg-teal-50/40 space-y-3">
                <span className="text-xs font-black uppercase text-teal-800 tracking-wider block">
                  {editingStaffIndex !== null ? 'Edit Team Member' : '+ Add New Team Member'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Full Name (e.g. Dr. Priya Sharma)"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    className="px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                  />
                  <input
                    type="text"
                    placeholder="Role / Title (e.g. Senior Barber)"
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    className="px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                  />
                  <input
                    type="text"
                    placeholder="Specialties (e.g. Fade, Beard)"
                    value={newStaff.specialties}
                    onChange={(e) => setNewStaff({ ...newStaff, specialties: e.target.value })}
                    className="px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAddStaff}
                    className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xs"
                  >
                    {editingStaffIndex !== null ? 'Save Changes' : '+ Add Team Member'}
                  </button>
                  {editingStaffIndex !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStaffIndex(null)
                        setNewStaff({ name: '', role: '', specialties: '', phone: '', description: '', profileImage: '', isAvailable: true })
                      }}
                      className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="pt-6 border-t border-zinc-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-5 py-3 rounded-2xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  ← Back to Services
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveStep(4, true)}
                  className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 active:scale-98"
                >
                  {saving ? 'Saving...' : 'Save & Continue to Preferences →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: BOOKING & QUEUE PREFERENCES */}
          {currentStep === 5 && (
            <div className="space-y-6 text-left">
              <div>
                <span className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Step 05 &bull; Rules</span>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
                  Booking & Queue Preferences
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1">
                  Determine how customers discover, reserve, and queue for services at your venue.
                </p>
              </div>

              {/* Feature Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Enable Appointment Booking</p>
                    <p className="text-xs text-zinc-500">Allow customers to schedule advance date/time slots</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.bookingSettings.enableAppointments}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        bookingSettings: { ...preferences.bookingSettings, enableAppointments: e.target.checked },
                      })
                    }
                    className="w-5 h-5 accent-teal-600 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Enable Live Queue</p>
                    <p className="text-xs text-zinc-500">Allow customers to take digital tokens & wait virtually</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.queueSettings.enableLiveQueue}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        queueSettings: { ...preferences.queueSettings, enableLiveQueue: e.target.checked },
                      })
                    }
                    className="w-5 h-5 accent-teal-600 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Allow Staff Selection</p>
                    <p className="text-xs text-zinc-500">Customers can pick specific barbers/doctors</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.bookingSettings.allowStaffSelection}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        bookingSettings: { ...preferences.bookingSettings, allowStaffSelection: e.target.checked },
                      })
                    }
                    className="w-5 h-5 accent-teal-600 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Allow Same-Day Appointments</p>
                    <p className="text-xs text-zinc-500">Accept bookings for the current day</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.bookingSettings.allowSameDayBooking}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        bookingSettings: { ...preferences.bookingSettings, allowSameDayBooking: e.target.checked },
                      })
                    }
                    className="w-5 h-5 accent-teal-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Number and Window Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Max Advance Booking (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={preferences.bookingSettings.maxAdvanceBookingDays}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        bookingSettings: { ...preferences.bookingSettings, maxAdvanceBookingDays: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Cancellation Window (Hours)</label>
                  <input
                    type="number"
                    min="0"
                    max="72"
                    value={preferences.bookingSettings.cancellationWindowHours}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        bookingSettings: { ...preferences.bookingSettings, cancellationWindowHours: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Buffer Between Slots (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={preferences.bookingSettings.bufferTimeBetweenAppointments}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        bookingSettings: { ...preferences.bookingSettings, bufferTimeBetweenAppointments: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Max Queue Capacity</label>
                  <input
                    type="number"
                    min="5"
                    max="200"
                    value={preferences.queueSettings.maxQueueCapacity}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        queueSettings: { ...preferences.queueSettings, maxQueueCapacity: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="pt-6 border-t border-zinc-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-5 py-3 rounded-2xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  ← Back to Staff
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveStep(5, true)}
                  className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 active:scale-98"
                >
                  {saving ? 'Saving...' : 'Save & Continue to Payments →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: PAYMENT CONFIGURATION */}
          {/* STEP 6: PAYMENTS */}
          {currentStep === 6 && (
            <div className="space-y-6 text-left">
              <div>
                <span className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Step 06 &bull; Settlement</span>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
                  Payment Configuration
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1">
                  ServeQ operates with direct in-person counter settlement. Zero gateway commissions and zero third-party lock-in.
                </p>
              </div>

              {/* Dedicated Pay at Business Card */}
              <div className="p-6 sm:p-7 rounded-3xl border-2 border-teal-600 bg-teal-50/40 shadow-sm relative space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-teal-200/60 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-teal-700" />
                      <h4 className="text-lg font-black text-zinc-950">Pay at Business (Counter Settlement)</h4>
                    </div>
                    <p className="text-xs text-zinc-600">
                      Customers join queues and book appointments for free, then settle their bill directly at your venue counter upon service.
                    </p>
                  </div>
                  <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-teal-700 text-white shadow-xs">
                    ✓ Active Mode
                  </span>
                </div>

                {/* Benefits Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-700">
                  <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white border border-teal-200/80 shadow-2xs">
                    <Check className="w-4 h-4 text-teal-600 shrink-0 stroke-[3]" />
                    <span><strong>Direct Settlement:</strong> Cash, Card POS, or Venue UPI QR</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white border border-teal-200/80 shadow-2xs">
                    <Check className="w-4 h-4 text-teal-600 shrink-0 stroke-[3]" />
                    <span><strong>Zero Gateway Setup:</strong> No KYC or linked account delays</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white border border-teal-200/80 shadow-2xs">
                    <Check className="w-4 h-4 text-teal-600 shrink-0 stroke-[3]" />
                    <span><strong>100% Revenue Retained:</strong> No platform payment commissions</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white border border-teal-200/80 shadow-2xs">
                    <Check className="w-4 h-4 text-teal-600 shrink-0 stroke-[3]" />
                    <span><strong>One-Click Tracking:</strong> Update & confirm paid in Dashboard</span>
                  </div>
                </div>

                {/* Optional Counter UPI Display */}
                <div className="pt-2">
                  <label className="text-xs font-bold text-zinc-800 block mb-1.5">
                    Venue UPI ID / VPA <span className="font-normal text-zinc-500">(Optional for Pay-at-Counter QR Display)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. bladeandshears@okhdfcbank"
                    value={paymentConfig.upiId}
                    onChange={(e) => setPaymentConfig({ ...paymentConfig, paymentMode: 'PAY_AT_BUSINESS', upiId: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-zinc-300 bg-white font-medium text-xs text-zinc-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    If provided, patrons can scan your UPI QR code directly at your counter to pay you immediately.
                  </p>
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="pt-6 border-t border-zinc-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="px-5 py-3 rounded-2xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  ← Back to Preferences
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveStep(6, true)}
                  className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 active:scale-98 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save & Proceed to Review →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: REVIEW & LAUNCH */}
          {currentStep === 7 && (
            <div className="space-y-6 text-left">
              <div>
                <span className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Step 07 &bull; Launch</span>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
                  Review & Launch Your Business
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1">
                  Verify your configuration before deploying live to the ServeQ network.
                </p>
              </div>

              {/* Summary Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Identity Summary */}
                <div className="p-5 rounded-3xl border border-zinc-200 bg-zinc-50/60 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">1. Business Profile</span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-xs font-bold text-teal-700 hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                    <h4 className="text-lg font-black text-zinc-950">{step1.name || 'Untitled Venue'}</h4>
                    <p className="text-xs text-zinc-500 capitalize">{step1.category} &bull; {step1.email || user?.email}</p>
                    <p className="text-xs text-zinc-600 line-clamp-2">{step1.description || 'No description entered'}</p>
                  </div>
                  <div className="pt-3 border-t border-zinc-200/60 mt-3 flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                    <span>✓ Profile Completed</span>
                  </div>
                </div>

                {/* 2. Location Summary */}
                <div className="p-5 rounded-3xl border border-zinc-200 bg-zinc-50/60 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">2. Location & Hours</span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-xs font-bold text-teal-700 hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                    <h4 className="text-lg font-black text-zinc-950">{step2.city || step2.location || 'Urban Location'}</h4>
                    <p className="text-xs text-zinc-600">{step2.address || 'Address configured'}</p>
                    <p className="text-xs text-zinc-500">
                      Timezone: {step2.timezone} &bull; {step2.weeklySchedule.filter((s) => s.isOpen).length} Operating Days/wk
                    </p>
                  </div>
                  <div className="pt-3 border-t border-zinc-200/60 mt-3 flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                    <span>✓ Hours Configured</span>
                  </div>
                </div>

                {/* 3. Services Summary */}
                <div className="p-5 rounded-3xl border border-zinc-200 bg-zinc-50/60 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">3. Services Catalog</span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="text-xs font-bold text-teal-700 hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                    <h4 className="text-lg font-black text-zinc-950">{services.length} Services Offered</h4>
                    <div className="space-y-1">
                      {services.slice(0, 3).map((s, i) => (
                        <div key={i} className="flex justify-between text-xs text-zinc-600">
                          <span className="truncate">• {s.name} ({s.duration}m)</span>
                          <span className="font-bold text-zinc-900">₹{s.price}</span>
                        </div>
                      ))}
                      {services.length > 3 && (
                        <p className="text-[11px] text-zinc-400 italic">+{services.length - 3} additional services</p>
                      )}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-zinc-200/60 mt-3 flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                    <span>✓ Services Active</span>
                  </div>
                </div>

                {/* 4. Staff Summary */}
                <div className="p-5 rounded-3xl border border-zinc-200 bg-zinc-50/60 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">4. Staff Team</span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(4)}
                        className="text-xs font-bold text-teal-700 hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                    <h4 className="text-lg font-black text-zinc-950">{staff.length} Team Members</h4>
                    <div className="space-y-1">
                      {staff.slice(0, 3).map((st, i) => (
                        <div key={i} className="flex justify-between text-xs text-zinc-600">
                          <span className="truncate">• {st.name}</span>
                          <span className="text-[11px] text-teal-700 font-semibold">{st.role}</span>
                        </div>
                      ))}
                      {staff.length === 0 && (
                        <p className="text-xs text-zinc-400 italic">On-duty auto-assignment enabled</p>
                      )}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-zinc-200/60 mt-3 flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                    <span>✓ Staff Roster Ready</span>
                  </div>
                </div>

                {/* 5. Preferences Summary */}
                <div className="p-5 rounded-3xl border border-zinc-200 bg-zinc-50/60 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">5. Booking Preferences</span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(5)}
                        className="text-xs font-bold text-teal-700 hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                    <h4 className="text-lg font-black text-zinc-950">Appointments & Queues</h4>
                    <p className="text-xs text-zinc-600">
                      Appointments: <strong>{preferences.bookingSettings.enableAppointments ? 'Enabled' : 'Disabled'}</strong> &bull; Live Queue: <strong>{preferences.queueSettings.enableLiveQueue ? 'Enabled' : 'Disabled'}</strong>
                    </p>
                    <p className="text-xs text-zinc-500">
                      Advance booking: {preferences.bookingSettings.maxAdvanceBookingDays} days &bull; Max queue capacity: {preferences.queueSettings.maxQueueCapacity}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-zinc-200/60 mt-3 flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                    <span>✓ Preferences Validated</span>
                  </div>
                </div>

                {/* 6. Payment Summary */}
                <div className="p-5 rounded-3xl border border-zinc-200 bg-zinc-50/60 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">6. Payment Config</span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(6)}
                        className="text-xs font-bold text-teal-700 hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                    <h4 className="text-lg font-black text-zinc-950">
                      Pay at Business (Counter Settlement)
                    </h4>
                    <p className="text-xs text-zinc-600">
                      Patrons pay directly at your counter via Cash, Card POS, or Venue UPI QR upon arrival.
                    </p>
                    {paymentConfig.upiId ? (
                      <p className="text-xs text-zinc-600 font-medium">Counter UPI: <span className="text-teal-800">{paymentConfig.upiId}</span></p>
                    ) : (
                      <p className="text-xs text-zinc-400 italic">Direct cash/POS counter payment</p>
                    )}
                  </div>
                  <div className="pt-3 border-t border-zinc-200/60 mt-3 flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                    <span>✓ Pay at Counter Active</span>
                  </div>
                </div>
              </div>

              {/* 7. ServeQ Business Subscription Plan Selection */}
              <div className="p-5 sm:p-6 rounded-3xl border border-zinc-200 bg-white shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-500" />
                      <h4 className="text-base font-black text-zinc-950">ServeQ Business Subscription Plan</h4>
                    </div>
                    <p className="text-xs text-zinc-500">
                      An active subscription is required to accept live queues and appointments. Paid securely via Razorpay.
                    </p>
                  </div>
                  {user?.subscription?.status === 'ACTIVE' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black uppercase tracking-wider shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {user.subscription.plan} Plan Active (₹{user.subscription.amount}/mo)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-black uppercase tracking-wider shrink-0">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Subscription Required
                    </span>
                  )}
                </div>

                {/* Two Plans: Basic (₹999) & Pro (₹1,999) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Basic Plan */}
                  <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                    user?.subscription?.status === 'ACTIVE' && user.subscription.plan === 'BASIC'
                      ? 'border-emerald-500 bg-emerald-50/30'
                      : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-300'
                  }`}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-zinc-200 text-zinc-700 px-2.5 py-0.5 rounded-full">
                          Starter Plan
                        </span>
                        <span className="text-xl font-black text-zinc-950">₹999 <span className="text-xs font-normal text-zinc-500">/ mo</span></span>
                      </div>
                      <div>
                        <h5 className="font-black text-base text-zinc-900">Basic Plan</h5>
                        <p className="text-xs text-zinc-500 mt-0.5">Essential live queue & appointment tools for standard venues.</p>
                      </div>
                      <ul className="space-y-1.5 text-xs text-zinc-600">
                        <li className="flex items-center gap-2">✓ Live virtual queue & slot bookings</li>
                        <li className="flex items-center gap-2">✓ Up to 3 active staff members</li>
                        <li className="flex items-center gap-2">✓ Pay at Counter with cash/UPI tracking</li>
                        <li className="flex items-center gap-2">✓ Standard volume analytics</li>
                      </ul>
                    </div>
                    <div className="pt-4 mt-4 border-t border-zinc-200/60">
                      {user?.subscription?.status === 'ACTIVE' && user.subscription.plan === 'BASIC' ? (
                        <span className="w-full py-2.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5">
                          ✓ Active Plan
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSubscriptionModalOpen(true)}
                          className="w-full py-2.5 rounded-xl bg-[#114227] hover:bg-[#0D361F] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          Pay ₹999 via Razorpay
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Pro Plan */}
                  <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between relative overflow-hidden ${
                    user?.subscription?.status === 'ACTIVE' && user.subscription.plan === 'PRO'
                      ? 'border-emerald-500 bg-emerald-50/30'
                      : 'border-teal-500 bg-teal-50/20 hover:border-teal-600'
                  }`}>
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-amber-600 text-white text-[9px] font-black uppercase px-3 py-0.5 rounded-bl-xl tracking-wider">
                      Most Popular
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full">
                          Growth & AI Tier
                        </span>
                        <span className="text-xl font-black text-zinc-950">₹1,999 <span className="text-xs font-normal text-zinc-500">/ mo</span></span>
                      </div>
                      <div>
                        <h5 className="font-black text-base text-zinc-900">Pro Plan</h5>
                        <p className="text-xs text-zinc-500 mt-0.5">Advanced automation & Google Gemini AI intelligence for busy venues.</p>
                      </div>
                      <ul className="space-y-1.5 text-xs text-zinc-600">
                        <li className="flex items-center gap-2 font-semibold text-teal-950">✓ Everything in Basic, plus:</li>
                        <li className="flex items-center gap-2">✓ Unlimited staff & specialists</li>
                        <li className="flex items-center gap-2 text-teal-700 font-bold">✓ Google Gemini AI Intelligence</li>
                        <li className="flex items-center gap-2">✓ Priority VIP queue passes</li>
                      </ul>
                    </div>
                    <div className="pt-4 mt-4 border-t border-zinc-200/60">
                      {user?.subscription?.status === 'ACTIVE' && user.subscription.plan === 'PRO' ? (
                        <span className="w-full py-2.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5">
                          ✓ Active Plan
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSubscriptionModalOpen(true)}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          Pay ₹1,999 via Razorpay
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ready to Launch Banner */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/5 border border-teal-200 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg mx-auto shadow-sm">
                  ✓
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-xl font-black text-zinc-950 tracking-tight">Everything is ready to launch</h3>
                  <p className="text-xs text-zinc-600 font-medium leading-relaxed">
                    Once launched, your business hub will be publicly discoverable, live counters will accept ticket entries, and your command dashboard will be fully unlocked.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving || services.length === 0}
                  onClick={handleLaunch}
                  className="px-8 py-4 rounded-2xl bg-[#52b788] hover:bg-[#40916c] active:scale-98 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-600/25 transition-all inline-flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Deploying Business Hub...</span>
                    </>
                  ) : (
                    <span>Launch My Business</span>
                  )}
                </button>
              </div>

              {/* Bottom Navigation */}
              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(6)}
                  className="px-5 py-3 rounded-2xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  ← Back to Payment Config
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Sticky Bottom Actions Bar */}
        <div className="flex-shrink-0 bg-white/95 backdrop-blur-sm border-t border-zinc-200/80 px-6 py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={currentStep === 1 || saving}
            onClick={() => {
              if (currentStep > 1) {
                setCurrentStep(currentStep - 1)
              }
            }}
            className="px-5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400">
              {currentStep} / {STEPS.length}
            </span>
            <div className="flex gap-1">
              {STEPS.map((s) => (
                <span
                  key={s.id}
                  className={`w-2 h-2 rounded-full transition-all ${
                    currentStep === s.id
                      ? 'bg-teal-600 w-4'
                      : completedSet.has(s.id)
                      ? 'bg-emerald-500'
                      : 'bg-zinc-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 7 ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveStep(currentStep, false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-all hidden sm:inline-block"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveStep(currentStep, true)}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 active:scale-98"
                >
                  {saving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={saving || services.length === 0}
                onClick={handleLaunch}
                className="px-7 py-2.5 rounded-xl bg-[#52b788] hover:bg-[#40916c] active:scale-98 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Launching...</span>
                  </>
                ) : (
                  <span>Launch My Business</span>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Subscription Plans Modal for Razorpay Checkout */}
      <SubscriptionPlansModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onSuccess={(updated) => {
          if (updated?.subscription) {
            setUser((prev) => ({
              ...prev,
              subscription: updated.subscription,
            }))
            if (business) {
              setBusiness((b) => ({
                ...b,
                subscription: updated.subscription,
              }))
            }
          }
        }}
      />
    </div>
  )
}
