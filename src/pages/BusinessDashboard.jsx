import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Users,
  Calendar,
  Scissors,
  Stethoscope,
  Sparkles,
  TrendingUp,
  Settings,
  Building2,
  Ticket,
  Wallet,
  User,
  UserCheck,
  LogOut,
  HelpCircle,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Store,
  Layers,
  Activity,
  Clock,
  MapPin,
  RefreshCw,
  Bell,
  CheckCircle2,
  AlertCircle,
  Check,
  Shield,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getQueue, callNext, extendUserTime, assignQueueStaff } from '../api/queue.api'
import { getBusiness, updateBusiness, toggleBusiness } from '../api/business.api'
import {
  getBusinessBookings,
  extendBooking,
  startBookingService,
  completeBookingService,
} from '../api/booking.api'
import { getBusinessAnalytics, generateAIAnalyticsReview } from '../api/analytics.api'
import { CATEGORY_METADATA, SERVICE_PRESETS, STAFF_PRESETS, ALLOWED_CATEGORIES } from '../utils/servicePresets'
import { toast } from 'react-hot-toast'
import { useSeo } from '../utils/useSeo'

export default function BusinessDashboard() {
  const { businessId } = useParams()
  const { user, logOut } = useAuth()
  const { joinAdmin, leaveRoom, onQueueUpdate, socket } = useSocket()
  const navigate = useNavigate()

  const [searchParams, setSearchParams] = useSearchParams()
  const validTabs = ['queue', 'appointments', 'services', 'staff', 'analytics', 'profile']
  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    initialTab && validTabs.includes(initialTab) ? initialTab : 'queue'
  )
  const [business, setBusiness] = useState(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Sync tab with URL search parameter
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
  }, [searchParams])

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId }, { replace: true })
    setMobileSidebarOpen(false)
  }

  useSeo({
    title: business?.name ? `${business.name} — Venue Command Console` : 'Venue Command Console',
    description: 'Manage live service counters, queues, staff rosters, and venue analytics on serveQ.',
    robots: 'noindex, nofollow',
  })
  const [queue, setQueue] = useState(null)
  const [bookings, setBookings] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [calling, setCalling] = useState(false)
  const [toggling, setToggling] = useState(false)

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    name: '',
    description: '',
    category: 'other',
    address: '',
    phone: '',
    location: '',
    timings: { open: '09:00', close: '18:00' },
    averageServiceTime: 15,
    basePrice: 0,
    services: [],
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingServices, setSavingServices] = useState(false)
  const [newService, setNewService] = useState({ name: '', duration: 20, price: 150 })
  const [editingServiceIndex, setEditingServiceIndex] = useState(null)
  const [editServiceForm, setEditServiceForm] = useState({ name: '', duration: 15, price: 0 })

  // Staff Management State (Barbers for salons, Doctors for clinics)
  const [newStaff, setNewStaff] = useState({ name: '', role: '', specialties: '', phone: '' })
  const [savingStaff, setSavingStaff] = useState(false)
  const [loadingAIReview, setLoadingAIReview] = useState(false)

  const isClinic = business?.category === 'clinic' || business?.category === 'healthcare'

  const fetchDashboardData = useCallback(async () => {
    try {
      const [bRes, qRes, bkRes] = await Promise.all([
        getBusiness(businessId),
        getQueue(businessId).catch(() => ({ data: { data: { queue: { users: [] } } } })),
        getBusinessBookings(businessId).catch(() => ({ data: { data: { bookings: [] } } })),
      ])

      const biz = bRes.data.data.business
      if (user?.role !== 'admin' &&
          biz.owner?._id?.toString() !== user?._id?.toString() &&
          biz.owner?.toString() !== user?._id?.toString()) {
        navigate('/')
        return
      }

      // Safe route protection: if onboarding is in progress, resume onboarding wizard
      if (biz.onboarding && biz.onboarding.status === 'IN_PROGRESS') {
        navigate(`/business/onboarding/${biz._id}`)
        return
      }

      setBusiness(biz)
      setQueue(qRes.data.data.queue)
      setBookings(bkRes.data.data.bookings || [])
      setProfileForm({
        name: biz.name || '',
        description: biz.description || '',
        category: biz.category || 'other',
        address: biz.address || '',
        phone: biz.phone || '',
        location: biz.location || '',
        timings: biz.timings || { open: '09:00', close: '18:00' },
        averageServiceTime: biz.averageServiceTime || 15,
        basePrice: biz.basePrice || 0,
        services: biz.services || [],
      })
    } catch (err) {
      console.error(err)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [businessId, user, navigate])

  useEffect(() => {
    fetchDashboardData()
    joinAdmin(businessId)

    const unsub = onQueueUpdate((updatedQueue) => {
      setQueue(updatedQueue)
    })

    const handleBookingUpdate = () => {
      getBusinessBookings(businessId).then(res => setBookings(res.data.data.bookings || [])).catch(() => {})
      getBusinessAnalytics(businessId).then(res => setAnalytics(res.data.data)).catch(() => {})
    }

    socket?.on('bookings:updated', handleBookingUpdate)

    return () => {
      leaveRoom(businessId)
      unsub?.()
      socket?.off('bookings:updated', handleBookingUpdate)
    }
  }, [businessId, fetchDashboardData, joinAdmin, leaveRoom, onQueueUpdate, socket])

  // Load analytics whenever analytics tab is active
  useEffect(() => {
    if (activeTab === 'analytics') {
      getBusinessAnalytics(businessId)
        .then(res => setAnalytics(res.data.data))
        .catch(err => toast.error(err.response?.data?.message || "Failed to load analytics"))
    }
  }, [activeTab, businessId])

  const handleCallNext = async () => {
    if (!queue?.users?.length) return
    setCalling(true)
    try {
      const res = await callNext(businessId)
      setQueue(res.data.data.queue)
      toast.success('Service completed & called next customer')
      getBusinessAnalytics(businessId).then(r => setAnalytics(r.data.data)).catch(() => {})
      getBusinessBookings(businessId).then(r => setBookings(r.data.data.bookings || [])).catch(() => {})
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to call next')
    } finally {
      setCalling(false)
    }
  }

  const handleExtendQueue = async (userId, mins) => {
    try {
      const res = await extendUserTime(businessId, userId, mins)
      setQueue(res.data.data.queue)
      toast.success(`Extended by ${mins}m`)
    } catch {
      toast.error('Error extending time')
    }
  }

  const handleAssignQueueStaff = async (userId, staffName) => {
    try {
      const res = await assignQueueStaff(businessId, userId, staffName)
      setQueue(res.data.data.queue)
      toast.success(`Assigned to ${staffName}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error assigning doctor/staff')
    }
  }

  const handleToggleOpen = async () => {
    setToggling(true)
    try {
      const res = await toggleBusiness(businessId)
      setBusiness(res.data.data.business)
      toast.success(`Business is now ${res.data.data.business.isOpen ? 'OPEN' : 'CLOSED'}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error toggling status')
    } finally {
      setToggling(false)
    }
  }

  // Appointment operations
  const handleStartBooking = async (id) => {
    try {
      await startBookingService(id)
      toast.success("Service started for appointment")
      fetchDashboardData()
      getBusinessAnalytics(businessId).then(r => setAnalytics(r.data.data)).catch(() => {})
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start service")
    }
  }

  const handleCompleteBooking = async (id) => {
    try {
      await completeBookingService(id)
      toast.success("Service completed!")
      fetchDashboardData()
      getBusinessAnalytics(businessId).then(r => setAnalytics(r.data.data)).catch(() => {})
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not complete service")
    }
  }

  const handleExtendBookingTime = async (id) => {
    const mins = prompt("Enter extra minutes to add (1-60):", "15")
    if (!mins) return
    try {
      await extendBooking(id, Number(mins))
      toast.success(`Appointment extended by ${mins}m`)
      fetchDashboardData()
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not extend booking")
    }
  }

  // Profile & Services Save
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await updateBusiness(businessId, profileForm)
      setBusiness(res.data.data.business)
      toast.success("Business profile & services updated successfully!")
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile")
    } finally {
      setSavingProfile(false)
    }
  }

  const handleAddService = () => {
    if (!newService.name.trim()) {
      toast.error('Please specify a service name')
      return
    }
    const duration = Math.max(1, Number(newService.duration) || 15)
    const price = Math.max(0, Number(newService.price) || 0)

    setProfileForm(prev => ({
      ...prev,
      services: [...prev.services, { name: newService.name.trim(), duration, price }],
    }))
    setNewService({ name: '', duration: 20, price: 150 })
    toast.success(`Added "${newService.name.trim()}" to catalog staging`)
  }

  const handleRemoveService = (index) => {
    if (profileForm.services.length <= 1) {
      toast.error('Every hub must keep at least one active service')
      return
    }
    setProfileForm(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }))
    if (editingServiceIndex === index) setEditingServiceIndex(null)
  }

  const handleStartEditService = (index) => {
    setEditingServiceIndex(index)
    setEditServiceForm({ ...profileForm.services[index] })
  }

  const handleSaveInlineService = () => {
    if (!editServiceForm.name.trim()) {
      toast.error('Service name cannot be empty')
      return
    }
    const updated = [...profileForm.services]
    updated[editingServiceIndex] = {
      name: editServiceForm.name.trim(),
      duration: Math.max(1, Number(editServiceForm.duration) || 15),
      price: Math.max(0, Number(editServiceForm.price) || 0),
    }
    setProfileForm(p => ({ ...p, services: updated }))
    setEditingServiceIndex(null)
  }

  const handleCancelInlineService = () => {
    setEditingServiceIndex(null)
  }

  const handleLoadCategoryPresets = () => {
    const presets = SERVICE_PRESETS[business?.category] || []
    if (presets.length === 0) return
    setProfileForm(prev => ({
      ...prev,
      services: [...presets],
    }))
    toast.success(`Loaded standard ${business?.category} services catalog!`)
  }

  const handleSaveServicesOnly = async () => {
    if (profileForm.services.length === 0) {
      toast.error('At least one service is required')
      return
    }
    setSavingServices(true)
    try {
      const res = await updateBusiness(businessId, { services: profileForm.services })
      setBusiness(res.data.data.business)
      toast.success('Service catalog saved and deployed live!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save services')
    } finally {
      setSavingServices(false)
    }
  }

  // Staff operations (Barbers for salons, Doctors for clinics)
  const handleSaveStaff = async (updatedStaff) => {
    setSavingStaff(true)
    try {
      const res = await updateBusiness(businessId, { staff: updatedStaff })
      setBusiness(res.data.data.business)
      toast.success(`${isClinic ? 'Doctor roster' : 'Barber team'} updated successfully!`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update team')
    } finally {
      setSavingStaff(false)
    }
  }

  const handleAddStaffMember = async (e) => {
    e?.preventDefault()
    if (!newStaff.name.trim()) {
      toast.error(`Please enter the ${isClinic ? 'doctor' : 'barber'} name`)
      return
    }
    const defaultRole = isClinic ? 'Doctor / Specialist' : 'Barber / Stylist'
    const member = {
      name: newStaff.name.trim(),
      role: newStaff.role.trim() || defaultRole,
      specialties: newStaff.specialties
        ? newStaff.specialties.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      phone: newStaff.phone.trim(),
      isAvailable: true,
      customersServed: 0,
      rating: 5.0,
    }
    const currentStaff = business?.staff || []
    const updated = [...currentStaff, member]
    await handleSaveStaff(updated)
    setNewStaff({ name: '', role: '', specialties: '', phone: '' })
  }

  const handleToggleStaffAvailability = async (index) => {
    const currentStaff = [...(business?.staff || [])]
    if (!currentStaff[index]) return
    currentStaff[index] = {
      ...currentStaff[index],
      isAvailable: !currentStaff[index].isAvailable,
    }
    await handleSaveStaff(currentStaff)
  }

  const handleDeleteStaff = async (index) => {
    const currentStaff = (business?.staff || []).filter((_, i) => i !== index)
    await handleSaveStaff(currentStaff)
  }

  const handleLoadStaffPresets = async () => {
    const categoryKey = isClinic ? 'clinic' : 'salon'
    const presets = STAFF_PRESETS[categoryKey] || STAFF_PRESETS.salon
    await handleSaveStaff([...presets])
  }

  // AI Analytics Review operation
  const handleTriggerAIReview = async () => {
    setLoadingAIReview(true)
    try {
      const res = await generateAIAnalyticsReview(businessId)
      setAnalytics(res.data.data)
      toast.success('AI Executive Review updated live!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate AI review')
    } finally {
      setLoadingAIReview(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const users = queue?.users || []
  const serving = users.find((u) => u.status === 'serving')

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full space-y-6">
      <div className="space-y-6">
        {/* Hub Identity Card in Sidebar */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border border-[#BDE8CB] shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#114227] text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs">
              {business?.name?.[0] || 'V'}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-xs text-zinc-950 truncate leading-tight">
                {business?.name || 'Venue Console'}
              </h3>
              <p className="text-[10px] text-zinc-500 font-medium truncate capitalize">
                {business?.category || 'Service Venue'} • Hub
              </p>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#BDE8CB]/60 flex items-center justify-between text-[11px]">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Service Desk
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                business?.isOpen
                  ? 'bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${business?.isOpen ? 'bg-[#16A34A] animate-pulse' : 'bg-rose-500'}`} />
              <span>{business?.isOpen ? 'OPEN' : 'CLOSED'}</span>
            </span>
          </div>
        </div>

        {/* Section 1: Command Operations (Tabs) */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1">
            Operations Console
          </p>
          {[
            {
              id: 'queue',
              label: 'Live Queue & Floor',
              icon: Users,
              count: users.length,
              badgeHighlight: Boolean(serving),
            },
            {
              id: 'appointments',
              label: 'Appointments',
              icon: Calendar,
              count: bookings.length,
            },
            {
              id: 'services',
              label: 'Services Catalog',
              icon: isClinic ? Stethoscope : Scissors,
              count: profileForm.services?.length || 0,
            },
            {
              id: 'staff',
              label: isClinic ? 'Doctors & Specialists' : 'Barbers & Stylists',
              icon: UserCheck,
              count: business?.staff?.length || 0,
            },
            {
              id: 'analytics',
              label: 'AI Analytics & Traffic',
              icon: TrendingUp,
              badge: 'AI',
            },
            {
              id: 'profile',
              label: 'Hub Settings',
              icon: Settings,
            },
          ].map((item) => {
            const isActive = activeTab === item.id
            const IconComponent = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#EAF5EC] text-[#114227] shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#114227]' : 'text-zinc-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-teal-100 text-teal-800 border border-teal-200">
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                      isActive
                        ? 'bg-[#114227] text-white'
                        : item.badgeHighlight
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Section 2: Platform & Route Switchers */}
        <div className="space-y-1 pt-2 border-t border-zinc-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1">
            Navigate & Views
          </p>

          {/* All My Venues */}
          <button
            type="button"
            onClick={() => {
              navigate('/business')
              if (isMobile) setMobileSidebarOpen(false)
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Building2 className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="truncate">All My Venues</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* Live Customer Queue Pass */}
          <button
            type="button"
            onClick={() => {
              navigate(`/queue/${businessId}`)
              if (isMobile) setMobileSidebarOpen(false)
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Ticket className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Customer Live Queue</span>
            </div>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </button>

          {/* Customer Directory */}
          <button
            type="button"
            onClick={() => {
              navigate('/customers')
              if (isMobile) setMobileSidebarOpen(false)
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Store className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="truncate">Customer Portal</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* Wallet */}
          <button
            type="button"
            onClick={() => {
              navigate('/wallet')
              if (isMobile) setMobileSidebarOpen(false)
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Wallet className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="truncate">Venue Wallet</span>
            </div>
            <span className="text-[10px] font-bold text-[#114227] bg-[#EAF7EE] px-2 py-0.5 rounded-full border border-[#BDE8CB]">
              ₹{(user?.walletBalance ?? 0).toLocaleString()}
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Sidebar: User snapshot, Help & Logout */}
      <div className="pt-4 border-t border-zinc-100 space-y-1">
        {/* User Card */}
        <button
          type="button"
          onClick={() => {
            navigate('/profile')
            if (isMobile) setMobileSidebarOpen(false)
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-zinc-100/80 transition-colors cursor-pointer text-left"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'O'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-zinc-900 truncate">{user?.name || 'Hub Owner'}</p>
            <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/support')}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-zinc-500" />
          <span>Help & Support</span>
        </button>

        <button
          type="button"
          onClick={() => {
            logOut()
            navigate('/login')
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-rose-500" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-zinc-900 flex flex-col font-sans">
      {/* ── TOP STICKY HEADER BAR ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Mobile Menu Toggle + ServeQ Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/business" className="flex items-center gap-2.5 text-decoration-none group">
            <img
              src="/serveq-logo.png"
              alt="serveQ"
              className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="hidden sm:inline-block text-[9px] font-black uppercase tracking-[0.2em] text-[#114227] bg-[#EAF7EE] px-2 py-0.5 rounded-full border border-[#BDE8CB]">
              Console
            </span>
          </Link>
        </div>

        {/* Center: Venue Details Pill */}
        <div className="hidden md:flex items-center gap-3 bg-zinc-50/80 border border-zinc-200/70 px-4 py-1.5 rounded-full">
          <div className="w-6 h-6 rounded-full bg-[#114227] text-white flex items-center justify-center text-xs font-black shrink-0">
            {business?.name?.[0] || 'V'}
          </div>
          <span className="font-bold text-xs text-zinc-900 truncate max-w-[200px]">
            {business?.name || 'Loading venue...'}
          </span>
          <span className="text-zinc-300">•</span>
          <span className="text-xs font-semibold text-zinc-500 capitalize">
            {business?.category || 'venue'}
          </span>
          <span className="text-zinc-300">•</span>
          <span
            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
              business?.isOpen
                ? 'bg-[#EAF7EE] text-[#16A34A] border border-[#CDEBD4]'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {business?.isOpen ? 'OPEN' : 'CLOSED'}
          </span>
        </div>

        {/* Right: Actions (Open/Close Services, Serve Next, Wallet, Profile) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Toggle Open/Close */}
          <button
            type="button"
            onClick={handleToggleOpen}
            disabled={toggling || !business?.isActive}
            className={`px-3.5 py-1.5 rounded-full font-bold text-xs border transition-all cursor-pointer ${
              !business?.isActive
                ? 'bg-zinc-100 text-slate-400 cursor-not-allowed'
                : business?.isOpen
                ? 'bg-white border-zinc-200 text-rose-600 hover:bg-rose-50'
                : 'bg-[#114227] text-white border-[#114227] hover:bg-[#0D361F]'
            }`}
          >
            {toggling ? 'Updating...' : business?.isOpen ? 'Close Services' : 'Open Services'}
          </button>

          {/* Quick Serve Next */}
          <button
            type="button"
            onClick={handleCallNext}
            disabled={calling || users.length === 0}
            className="px-4 py-1.5 rounded-full bg-zinc-950 text-white font-bold text-xs hover:bg-zinc-800 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>{calling ? 'Calling...' : 'Serve Next'}</span>
            {users.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-black">
                {users.length}
              </span>
            )}
          </button>

          {/* Wallet */}
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="hidden sm:flex px-3.5 py-1.5 rounded-full bg-[#EAF7EE] border border-[#BDE8CB] hover:bg-[#DDF3E3] text-xs font-bold text-[#114227] items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5 text-[#114227]" />
            <span>₹{(user?.walletBalance ?? 0).toLocaleString()}</span>
          </button>

          {/* Profile Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="flex items-center gap-1.5 p-1 pl-1.5 pr-2 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-700 text-white flex items-center justify-center font-bold text-xs border border-zinc-200">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'O'}
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {showUserMenu && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-white border border-zinc-200 rounded-2xl shadow-xl p-1.5 z-50 space-y-1">
                <div className="px-3 py-2 border-b border-zinc-100">
                  <p className="text-xs font-bold text-zinc-900 truncate">{user?.name || 'Hub Owner'}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/profile')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Account Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/business')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>All Venues</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/wallet')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Wallet & Payouts</span>
                </button>
                <div className="border-t border-zinc-100 my-1" />
                <button
                  type="button"
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

      {/* ── BODY: SIDEBAR + MAIN CANVAS ── */}
      <div className="flex-1 flex w-full">
        {/* Desktop Left Sidebar */}
        <aside className="w-64 shrink-0 hidden lg:flex flex-col justify-between py-5 px-4 border-r border-zinc-200/70 min-h-[calc(100vh-61px)] bg-white/60 backdrop-blur-xs sticky top-[61px] self-start max-h-[calc(100vh-61px)] overflow-y-auto">
          {renderSidebarContent(false)}
        </aside>

        {/* Mobile Left Sidebar Drawer */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileSidebarOpen(false)}
                className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs"
              />
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-72 max-w-[85vw] bg-white h-full z-10 shadow-2xl p-4 flex flex-col justify-between overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3">
                  <div className="flex items-center gap-2">
                    <img src="/serveq-logo.png" alt="serveQ" className="h-6 w-auto" />
                    <span className="text-[10px] font-black uppercase text-[#114227] bg-[#EAF7EE] px-2 py-0.5 rounded-full">
                      Console
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {renderSidebarContent(true)}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MAIN CANVAS */}
        <main className="flex-1 px-4 py-5 sm:px-8 sm:py-7 space-y-6 min-w-0 max-w-7xl">
          {/* Top Venue Overview Card / Hero Banner */}
          <div className="rounded-3xl bg-gradient-to-r from-[#F4F9F5] via-[#EBF5ED] to-[#E2F0E5] border border-[#DCEDE0] p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-2xs">
            <div className="space-y-1.5 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#114227]">
                  Venue Command Center
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                {business?.name || 'Your Venue Hub'}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-600 font-medium">
                Live queue control, appointment slots, staff rosters, and AI operational insights.
              </p>
            </div>

            {/* 4 Quick Metric Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full md:w-auto z-10">
              <div className="bg-white/80 backdrop-blur-xs border border-[#BDE8CB] rounded-2xl p-3 text-center min-w-[95px] shadow-2xs">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Serving</p>
                <p className="font-black text-sm text-zinc-900 mt-0.5 truncate">
                  {serving ? `Token #${users.indexOf(serving) + 1}` : 'Idle'}
                </p>
              </div>
              <div className="bg-white/80 backdrop-blur-xs border border-[#BDE8CB] rounded-2xl p-3 text-center min-w-[95px] shadow-2xs">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">In Line</p>
                <p className="font-black text-sm text-zinc-900 mt-0.5">
                  {users.filter((u) => u.status === 'waiting').length} waiting
                </p>
              </div>
              <div className="bg-white/80 backdrop-blur-xs border border-[#BDE8CB] rounded-2xl p-3 text-center min-w-[95px] shadow-2xs">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Bookings</p>
                <p className="font-black text-sm text-[#16A34A] mt-0.5">
                  {bookings.length} slots
                </p>
              </div>
              <div className="bg-white/80 backdrop-blur-xs border border-[#BDE8CB] rounded-2xl p-3 text-center min-w-[95px] shadow-2xs">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Staff</p>
                <p className="font-black text-sm text-zinc-900 mt-0.5">
                  {(business?.staff || []).length || 1} active
                </p>
              </div>
            </div>

            {/* Soft ambient blur circle */}
            <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-emerald-200/40 rounded-full blur-2xl pointer-events-none" />
          </div>

          {/* Quick Tabs Pill Switcher */}
          <div className="flex items-center gap-2 border-b border-zinc-200/80 pb-2 overflow-x-auto scrollbar-none">
            {[
              { id: 'queue', label: 'Live Queue & Floor', count: users.length },
              { id: 'appointments', label: 'Appointments', count: bookings.length },
              { id: 'services', label: 'Services Catalog', count: profileForm.services?.length || 0 },
              {
                id: 'staff',
                label: isClinic ? 'Doctors & Specialists' : 'Barbers & Stylists',
                count: business?.staff?.length || 0,
              },
              { id: 'analytics', label: 'AI Analytics & Daily Traffic' },
              { id: 'profile', label: 'Hub Settings' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#114227] text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      activeTab === tab.id ? 'bg-[#0D361F] text-emerald-200' : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

      {/* TAB 1: LIVE QUEUE */}
      {activeTab === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Active Serving Card */}
          <div className="lg:col-span-12">
            <div className="bg-white border border-teal-200 rounded-3xl p-6 md:p-8 shadow-sm bg-gradient-to-r from-teal-50/60 to-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xs font-black border ${
                  serving ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-slate-100 border-zinc-200 text-slate-400'
                }`}>
                  {serving ? 'ACTIVE' : 'IDLE'}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 px-2.5 py-1 rounded-md">
                    Currently Serving
                  </span>
                  <h3 className="text-2xl font-black text-zinc-950 mt-1">
                    {serving ? (serving.userId?.name || 'Customer') : 'No active session currently'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Service: <span className="font-semibold text-zinc-800">{serving?.serviceType || 'N/A'}</span> • Target Duration: {serving?.serviceTime || business.averageServiceTime} mins
                  </p>

                  {/* Prominent Assigned Doctor / Specialist Display */}
                  {serving && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 pt-2.5 border-t border-teal-100/80">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {isClinic ? 'Assigned Doctor:' : 'Assigned Specialist:'}
                      </span>
                      {serving.assignedStaff?.name ? (
                        <div className="inline-flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-teal-200 shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-black text-xs text-zinc-950">
                            {serving.assignedStaff.name}
                          </span>
                          {serving.assignedStaff.role && (
                            <span className="text-[11px] text-teal-700 font-semibold">
                              ({serving.assignedStaff.role})
                            </span>
                          )}
                          {serving.assignedStaff.autoAssigned && (
                            <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded">
                              Auto-Assigned
                            </span>
                          )}
                        </div>
                      ) : business.staff && business.staff.length > 0 ? (
                        <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-teal-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-bold text-xs text-zinc-900">
                            {business.staff[0].name}
                          </span>
                          <span className="text-[10px] text-teal-600 font-medium">
                            ({business.staff[0].role || (isClinic ? 'Doctor' : 'Staff')})
                          </span>
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 rounded font-bold">
                            On-Duty
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic bg-white px-2.5 py-1 rounded-lg border border-zinc-200">
                          {isClinic ? 'On-Duty General Physician' : 'On-Duty Specialist'}
                        </span>
                      )}

                      {business.staff && business.staff.length > 0 && (
                        <select
                          value={serving.assignedStaff?.name || ''}
                          onChange={(e) => handleAssignQueueStaff(serving.userId?._id || serving.userId, e.target.value)}
                          className="text-[11px] font-bold text-teal-800 bg-white border border-teal-300 rounded-lg px-2 py-1 shadow-2xs hover:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                        >
                          <option value="" disabled>
                            Switch {isClinic ? 'Doctor' : 'Staff'}...
                          </option>
                          {business.staff.map((s, idx) => (
                            <option key={idx} value={s.name}>
                              {s.name} ({s.role || (isClinic ? 'Doctor' : 'Staff')})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {serving && (
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={() => handleExtendQueue(serving.userId?._id || serving.userId, 5)}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-zinc-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 shadow-xs"
                  >
                    +5m Extend
                  </button>
                  <button
                    onClick={() => handleExtendQueue(serving.userId?._id || serving.userId, 15)}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-zinc-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 shadow-xs"
                  >
                    +15m Extend
                  </button>
                  <button
                    onClick={handleCallNext}
                    className="flex-1 md:flex-none px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Complete & Next →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Queue Table */}
          <div className="lg:col-span-12 bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">Queue Roster</h3>
                <p className="text-xs text-slate-400">Total waiting customers: {users.filter(u => u.status === 'waiting').length}</p>
              </div>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                Live Synced
              </span>
            </div>

            {users.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                The queue is empty. Customers joining online will appear here in real-time.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-zinc-100">
                    <tr>
                      <th className="py-3.5 px-6">#</th>
                      <th className="py-3.5 px-6">Customer</th>
                      <th className="py-3.5 px-6">Service</th>
                      <th className="py-3.5 px-6">{isClinic ? 'Assigned Doctor' : 'Assigned Staff'}</th>
                      <th className="py-3.5 px-6">Duration</th>
                      <th className="py-3.5 px-6">Est. Start Time</th>
                      <th className="py-3.5 px-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {users.map((u, i) => (
                      <tr key={i} className={u.status === 'serving' ? 'bg-teal-50/40' : 'hover:bg-slate-50'}>
                        <td className="py-4 px-6 font-bold text-slate-400">{i + 1}</td>
                        <td className="py-4 px-6">
                          <p className="font-bold text-zinc-900">{u.userId?.name || 'Walk-in / App User'}</p>
                          <p className="text-[10px] text-slate-400">{u.userId?.email || 'N/A'}</p>
                        </td>
                        <td className="py-4 px-6 font-medium text-slate-700">{u.serviceType || 'general'}</td>
                        <td className="py-4 px-6">
                          {u.assignedStaff?.name ? (
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-zinc-950 text-xs">{u.assignedStaff.name}</span>
                                {u.assignedStaff.autoAssigned && (
                                  <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded">
                                    Auto
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-teal-700 font-medium">
                                {u.assignedStaff.role || (isClinic ? 'Doctor / Specialist' : 'Barber / Stylist')}
                              </p>
                              {business.staff && business.staff.length > 1 && (
                                <select
                                  value={u.assignedStaff.name}
                                  onChange={(e) => handleAssignQueueStaff(u.userId?._id || u.userId, e.target.value)}
                                  className="mt-1 text-[10px] font-semibold text-slate-600 bg-slate-50 border border-zinc-200 rounded px-1.5 py-0.5 hover:bg-white focus:outline-none focus:border-teal-500 cursor-pointer"
                                >
                                  {business.staff.map((s, idx) => (
                                    <option key={idx} value={s.name}>
                                      Reassign: {s.name} ({s.role || (isClinic ? 'Doctor' : 'Staff')})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ) : business.staff && business.staff.length > 0 ? (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="font-bold text-zinc-800 text-xs">{business.staff[0].name}</span>
                                <span className="text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-200 px-1 py-0.2 rounded">
                                  On-Duty
                                </span>
                              </div>
                              <select
                                defaultValue=""
                                onChange={(e) => handleAssignQueueStaff(u.userId?._id || u.userId, e.target.value)}
                                className="text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                              >
                                <option value="" disabled>
                                  Assign {isClinic ? 'Doctor' : 'Staff'}...
                                </option>
                                {business.staff.map((s, idx) => (
                                  <option key={idx} value={s.name}>
                                    {s.name} ({s.role || (isClinic ? 'Doctor' : 'Staff')})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              {isClinic ? 'On-Duty Doctor' : 'On-Duty Staff'}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-bold text-zinc-900">{u.serviceTime} mins</td>
                        <td className="py-4 px-6 text-slate-600">
                          {u.estimatedStartTime ? new Date(u.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${
                            u.status === 'serving' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <div>
              <h3 className="text-base font-black text-zinc-950">Appointments & Time Slots</h3>
              <p className="text-xs text-slate-500">Manage customer bookings, start/complete appointments, and handle extensions.</p>
            </div>
            <span className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">
              {bookings.length} Bookings
            </span>
          </div>

          {bookings.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              No bookings recorded yet. Available time slots will show here as users book them.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-zinc-100">
                  <tr>
                    <th className="py-3.5 px-4">Time Slot</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Service</th>
                    <th className="py-3.5 px-4">Price</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {bookings.map((b) => (
                    <tr key={b._id} className="hover:bg-slate-50">
                      <td className="py-4 px-4 font-bold text-zinc-900">
                        {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <p className="text-[10px] text-slate-400 font-normal">{new Date(b.startTime).toLocaleDateString()}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-zinc-900">{b.userId?.name || 'Customer'}</p>
                        <p className="text-[10px] text-slate-400">{b.userId?.email || 'N/A'}</p>
                      </td>
                      <td className="py-4 px-4 font-medium">
                        <p className="font-semibold text-zinc-900">{b.serviceType}</p>
                        {b.assignedStaff?.name && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-teal-800 font-bold">
                            <span>{b.assignedStaff.name}</span>
                            <span className="text-[10px] text-zinc-400 font-normal">({b.assignedStaff.role || (isClinic ? 'Doctor' : 'Barber')})</span>
                            {b.assignedStaff.autoAssigned && (
                              <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.2 rounded font-semibold">
                                On-Duty
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 font-bold text-teal-800">₹{b.paidAmount}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          b.status === 'serving' ? 'bg-emerald-100 text-emerald-800 animate-pulse' :
                          b.status === 'completed' ? 'bg-slate-100 text-slate-600' :
                          b.status === 'delayed' ? 'bg-amber-100 text-amber-800' :
                          b.status === 'cancelled' || b.status === 'refunded' ? 'bg-rose-100 text-rose-700' :
                          'bg-teal-100 text-teal-800'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-2">
                        {b.status === 'scheduled' || b.status === 'confirmed' || b.status === 'waiting' ? (
                          <>
                            <button
                              onClick={() => handleStartBooking(b._id)}
                              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[11px]"
                            >
                              Start Service
                            </button>
                            <button
                              onClick={() => handleExtendBookingTime(b._id)}
                              className="px-3 py-1.5 border border-zinc-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-[11px]"
                            >
                              Extend
                            </button>
                          </>
                        ) : b.status === 'serving' ? (
                          <button
                            onClick={() => handleCompleteBooking(b._id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px]"
                          >
                            Mark Completed
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Finished</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: SERVICES CATALOG */}
      {activeTab === 'services' && (
        <div className="space-y-6 text-left">
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
              <div>
                <h3 className="text-xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
                  <span>Services Catalog</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-extrabold">
                    {profileForm.services?.length || 0} Active
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 font-medium">
                  Add, configure, and price the services your patrons can select when booking or joining queues.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleLoadCategoryPresets}
                  className="text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100/80 border border-teal-200 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
                >
                  Load Standard Presets
                </button>
                <button
                  type="button"
                  onClick={handleSaveServicesOnly}
                  disabled={savingServices}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingServices ? 'Deploying...' : 'Save & Deploy'}
                </button>
              </div>
            </div>

            {/* List of services with Inline Edit */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                Current Services ({profileForm.services.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profileForm.services.map((svc, i) => {
                  const isEditing = editingServiceIndex === i

                  if (isEditing) {
                    return (
                      <div
                        key={i}
                        className="p-4 rounded-2xl bg-teal-50/70 border border-teal-300 space-y-3 shadow-xs"
                      >
                        <p className="text-[10px] font-black uppercase text-teal-800 tracking-wider">
                          Edit Service #{i + 1}
                        </p>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editServiceForm.name}
                            onChange={(e) => setEditServiceForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                            placeholder="Service Name"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                value={editServiceForm.duration}
                                onChange={(e) => setEditServiceForm(f => ({ ...f, duration: e.target.value }))}
                                className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                                placeholder="Duration"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">min</span>
                            </div>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                value={editServiceForm.price}
                                onChange={(e) => setEditServiceForm(f => ({ ...f, price: e.target.value }))}
                                className="w-full pl-6 pr-3 py-2 rounded-xl border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                                placeholder="Price"
                              />
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400 font-bold">₹</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleCancelInlineService}
                            className="px-3 py-1 rounded-lg text-xs font-bold text-zinc-500 hover:bg-zinc-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveInlineService}
                            className="px-3.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={i}
                      className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3 hover:border-zinc-300 transition-colors shadow-xs"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-950 truncate">{svc.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 font-medium">
                          <span className="px-2 py-0.5 rounded-md bg-zinc-200/80 text-zinc-700 font-bold text-[10px]">
                            {svc.duration} mins
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-teal-100/70 text-teal-800 font-black text-[10px]">
                            ₹{svc.price}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditService(i)}
                          className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-950 text-xs font-bold shadow-2xs transition-all hover:bg-zinc-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveService(i)}
                          className="w-8 h-8 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 flex items-center justify-center font-bold text-xs transition-colors"
                          title="Delete service"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Add New Service Form */}
            <div className="p-5 rounded-2xl border border-dashed border-teal-300/80 bg-teal-50/40 space-y-3">
              <p className="text-xs font-black uppercase text-teal-800 tracking-wider">
                + Add New Service to Catalog
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    placeholder="Service Name (e.g. Hair Wash & Blow Dry)"
                    value={newService.name}
                    onChange={(e) => setNewService(s => ({ ...s, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs bg-white focus:outline-none focus:border-teal-600 font-medium"
                  />
                </div>
                <div className="sm:col-span-3">
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Duration"
                      min="1"
                      value={newService.duration}
                      onChange={(e) => setNewService(s => ({ ...s, duration: Number(e.target.value) }))}
                      className="w-full pl-3.5 pr-8 py-2.5 rounded-xl border border-zinc-200 text-xs bg-white focus:outline-none focus:border-teal-600 font-medium"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">mins</span>
                  </div>
                </div>
                <div className="sm:col-span-3">
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Price"
                      min="0"
                      value={newService.price}
                      onChange={(e) => setNewService(s => ({ ...s, price: Number(e.target.value) }))}
                      className="w-full pl-6 pr-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs bg-white focus:outline-none focus:border-teal-600 font-medium"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">₹</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddService}
                className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs"
              >
                + Add Service to Catalog
              </button>
            </div>

            {/* Bottom Save & Deploy */}
            <div className="flex items-center justify-end pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={handleSaveServicesOnly}
                disabled={savingServices}
                className="px-6 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2 disabled:opacity-50 active:scale-98"
              >
                {savingServices ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deploying Catalog...
                  </>
                ) : (
                  'Deploy & Save All Services'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: STAFF ROSTER (BARBERS OR DOCTORS) */}
      {activeTab === 'staff' && (
        <div className="space-y-6 text-left">
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
              <div>
                <h3 className="text-xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
                  <span>{isClinic ? 'Doctors & Medical Specialists' : 'Barbers & Master Stylists'}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-extrabold">
                    {business?.staff?.length || 0} Registered
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 font-medium">
                  {isClinic
                    ? 'Manage your clinic doctors, consultation specialties, and on-duty patient queue availability.'
                    : 'Manage your salon barbers, styling specialties, chair capacity, and live availability.'}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleLoadStaffPresets}
                  disabled={savingStaff}
                  className="text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100/80 border border-teal-200 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  Load Standard Roster
                </button>
              </div>
            </div>

            {/* List of Staff Members */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                Active Team Roster ({business?.staff?.length || 0})
              </h4>

              {(!business?.staff || business.staff.length === 0) ? (
                <div className="p-12 text-center border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50 space-y-3">
                  <p className="text-sm font-bold text-zinc-700">No {isClinic ? 'doctors' : 'barbers'} registered yet</p>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Add your staff below or click "Load Standard Roster" to get started with recommended profiles.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {business.staff.map((member, i) => (
                    <div
                      key={member._id || i}
                      className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 hover:border-zinc-300 transition-all shadow-xs flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black tracking-wider ${
                            member.isAvailable
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-zinc-200 text-zinc-500 border border-zinc-300'
                          }`}>
                            {member.name ? member.name.slice(0, 2).toUpperCase() : 'ST'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-base font-black text-zinc-950 tracking-tight">{member.name}</h5>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                member.isAvailable
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {member.isAvailable ? 'Available' : 'Off Duty'}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-teal-800 mt-0.5">{member.role}</p>
                            {member.phone && (
                              <p className="text-[11px] text-zinc-500 mt-0.5">
                                <a
                                  href={`tel:${member.phone}`}
                                  className="text-teal-700 hover:text-teal-800 underline transition-colors"
                                >
                                  {member.phone}
                                </a>
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(i)}
                          disabled={savingStaff}
                          className="w-8 h-8 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 flex items-center justify-center font-bold text-xs transition-colors"
                          title="Remove staff member"
                        >
                          ✕
                        </button>
                      </div>

                      {member.specialties?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {member.specialties.map((spec, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-[11px] font-medium text-zinc-700"
                            >
                              {spec}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-zinc-200/80 text-xs">
                        <div className="flex items-center gap-3 text-zinc-600 font-semibold">
                          <span>Served: <strong className="text-zinc-950">{member.customersServed || 0}</strong></span>
                          <span>•</span>
                          <span>Rating: <strong className="text-amber-600">★ {member.rating ? Number(member.rating).toFixed(1) : '5.0'}</strong></span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleStaffAvailability(i)}
                          disabled={savingStaff}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            member.isAvailable
                              ? 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                              : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {member.isAvailable ? 'Set Off-Duty' : 'Set Available'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Barber / Doctor Form */}
            <form onSubmit={handleAddStaffMember} className="p-5 rounded-2xl border border-dashed border-teal-300/80 bg-teal-50/40 space-y-4">
              <p className="text-xs font-black uppercase text-teal-800 tracking-wider">
                + Add New {isClinic ? 'Doctor / Specialist' : 'Barber / Stylist'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder={isClinic ? "Doctor Name (e.g. Dr. Priya Nair)" : "Barber Name (e.g. Alex Rivera)"}
                  value={newStaff.name}
                  onChange={(e) => setNewStaff(s => ({ ...s, name: e.target.value }))}
                  className="px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs bg-white focus:outline-none focus:border-teal-600 font-medium"
                  required
                />
                <input
                  type="text"
                  placeholder={isClinic ? "Designation (e.g. Consultant Physician)" : "Role (e.g. Master Stylist & Colorist)"}
                  value={newStaff.role}
                  onChange={(e) => setNewStaff(s => ({ ...s, role: e.target.value }))}
                  className="px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs bg-white focus:outline-none focus:border-teal-600 font-medium"
                />
                <input
                  type="text"
                  placeholder={isClinic ? "Specialties (comma-separated, e.g. Internal Medicine, Pediatrics)" : "Specialties (e.g. Beard Craft, Fade, Styling)"}
                  value={newStaff.specialties}
                  onChange={(e) => setNewStaff(s => ({ ...s, specialties: e.target.value }))}
                  className="px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs bg-white focus:outline-none focus:border-teal-600 font-medium"
                />
                <input
                  type="text"
                  placeholder="Phone (e.g. +91 98110 12345)"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff(s => ({ ...s, phone: e.target.value }))}
                  className="px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs bg-white focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={savingStaff}
                className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs disabled:opacity-50"
              >
                {savingStaff ? 'Saving...' : `+ Add ${isClinic ? 'Doctor' : 'Barber'} to Roster`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: PROFILE & SERVICES SETUP */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-8">
          <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-zinc-950">Venue Details & Profile Setup</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Business Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Category</label>
                <select
                  value={profileForm.category}
                  onChange={(e) => setProfileForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  {ALLOWED_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_METADATA[cat]?.label || cat.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Phone Contact</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">City / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Connaught Place, New Delhi"
                  value={profileForm.location}
                  onChange={(e) => setProfileForm(p => ({ ...p, location: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Address</label>
                <input
                  type="text"
                  placeholder="Full street address..."
                  value={profileForm.address}
                  onChange={(e) => setProfileForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Operating Hours</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={profileForm.timings?.open || '09:00'}
                    onChange={(e) => setProfileForm(p => ({ ...p, timings: { ...p.timings, open: e.target.value } }))}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 text-sm"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="time"
                    value={profileForm.timings?.close || '18:00'}
                    onChange={(e) => setProfileForm(p => ({ ...p, timings: { ...p.timings, close: e.target.value } }))}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Default Service Time (mins)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={profileForm.averageServiceTime}
                  onChange={(e) => setProfileForm(p => ({ ...p, averageServiceTime: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Service & Price Management */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-zinc-950">Add / Edit Services & Prices</h3>

            {/* List of services */}
            <div className="space-y-3">
              {profileForm.services.map((svc, i) => (
                <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-zinc-200 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{svc.name}</p>
                    <p className="text-xs text-slate-500">{svc.duration} minutes • ₹{svc.price}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveService(i)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            {/* Add service form */}
            <div className="p-5 rounded-2xl border border-dashed border-zinc-300 bg-slate-50/50 space-y-3">
              <p className="text-xs font-bold uppercase text-slate-500">New Service</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Service Name"
                  value={newService.name}
                  onChange={(e) => setNewService(s => ({ ...s, name: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-zinc-200 text-xs bg-white"
                />
                <input
                  type="number"
                  placeholder="Duration (mins)"
                  value={newService.duration}
                  onChange={(e) => setNewService(s => ({ ...s, duration: Number(e.target.value) }))}
                  className="px-3 py-2 rounded-xl border border-zinc-200 text-xs bg-white"
                />
                <input
                  type="number"
                  placeholder="Price (₹)"
                  value={newService.price}
                  onChange={(e) => setNewService(s => ({ ...s, price: Number(e.target.value) }))}
                  className="px-3 py-2 rounded-xl border border-zinc-200 text-xs bg-white"
                />
              </div>
              <button
                type="button"
                onClick={handleAddService}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
              >
                + Add Service to List
              </button>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-3.5 rounded-xl bg-zinc-950 text-white font-bold text-sm hover:bg-zinc-800 disabled:opacity-50"
            >
              {savingProfile ? 'Saving Changes...' : 'Save Profile & Services'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: AI ANALYTICS & REVENUE */}
      {activeTab === 'analytics' && (
        <div className="space-y-8 text-left">
          {/* Executive Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-teal-200 p-5 rounded-3xl shadow-sm bg-gradient-to-br from-teal-50/40 to-white">
              <p className="text-xs font-bold uppercase text-teal-800 tracking-wider">Total Revenue</p>
              <p className="text-3xl font-black text-teal-700 mt-2">₹{analytics?.metrics?.totalRevenue ?? 0}</p>
              <p className="text-[10px] text-zinc-500 mt-1 font-medium">
                From {analytics?.metrics?.activeBookings ?? 0} active + {analytics?.metrics?.completedBookings ?? 0} completed
              </p>
            </div>

            <div className="bg-white border border-zinc-200 p-5 rounded-3xl shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Unique Customers</p>
              <p className="text-3xl font-black text-zinc-950 mt-2">{analytics?.metrics?.customerCount ?? 0}</p>
              <p className="text-[10px] text-slate-400 mt-1">Patrons booked & served</p>
            </div>

            <div className="bg-white border border-zinc-200 p-5 rounded-3xl shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Active Bookings</p>
              <p className="text-3xl font-black text-teal-800 mt-2">{analytics?.metrics?.activeBookings ?? 0}</p>
              <p className="text-[10px] text-teal-700 font-semibold mt-1">Confirmed & in-service</p>
            </div>

            <div className="bg-white border border-zinc-200 p-5 rounded-3xl shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Completed Visits</p>
              <p className="text-3xl font-black text-indigo-700 mt-2">{analytics?.metrics?.completedBookings ?? 0}</p>
              <p className="text-[10px] text-slate-400 mt-1">Finished appointments</p>
            </div>

            <div className={`bg-white border p-5 rounded-3xl shadow-sm transition-all ${
              (analytics?.metrics?.cancelledBookings ?? 0) > 0 ? 'border-rose-300 bg-rose-50/30' : 'border-zinc-200'
            }`}>
              <p className="text-xs font-bold uppercase text-rose-600 tracking-wider">Cancelled Bookings</p>
              <p className="text-3xl font-black text-rose-600 mt-2">{analytics?.metrics?.cancelledBookings ?? 0}</p>
              <p className="text-[10px] text-rose-700 font-semibold mt-1">
                ₹{analytics?.metrics?.cancelledRevenue ?? 0} refunded to patrons
              </p>
            </div>
          </div>

          {/* PER-DAY CUSTOMER TRAFFIC DATA */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-5">
              <div>
                <h3 className="text-lg font-black text-zinc-950 flex items-center gap-2">
                  <span>Per-Day Customer Traffic & Visits Breakdown</span>
                </h3>
                <p className="text-xs text-zinc-500 font-medium">
                  Complete day-by-day record of customer footfall, active & completed appointments, daily revenue, and cancelled bookings.
                </p>
              </div>
              <span className="text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                Rolling Traffic & Schedule History
              </span>
            </div>

            {(!analytics?.dailyBreakdown || analytics.dailyBreakdown.length === 0) ? (
              <div className="p-12 text-center text-slate-400">
                Loading daily traffic breakdown...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-zinc-100">
                    <tr>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Bookings</th>
                      <th className="py-3.5 px-4">Active & Completed</th>
                      <th className="py-3.5 px-4">Cancelled Bookings</th>
                      <th className="py-3.5 px-4">Revenue Earned</th>
                      <th className="py-3.5 px-4">Most Popular Service</th>
                      <th className="py-3.5 px-4 text-right">Traffic Intensity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium">
                    {analytics.dailyBreakdown.map((day, idx) => (
                      <tr key={day.date || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4">
                          <p className="font-bold text-zinc-950">{day.displayDate}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">{day.date}</p>
                        </td>
                        <td className="py-4 px-4 font-bold text-zinc-900">
                          <span className="text-sm">{day.totalBookings ?? day.totalCustomers ?? 0}</span>
                          <span className="text-zinc-400 text-[11px] ml-1">bookings</span>
                        </td>
                        <td className="py-4 px-4 font-semibold text-xs">
                          <span className="text-teal-700 font-bold">{day.activeCount || 0} active</span>
                          <span className="text-zinc-300 mx-1.5">•</span>
                          <span className="text-indigo-700 font-bold">{day.completedCount || 0} completed</span>
                        </td>
                        <td className="py-4 px-4">
                          {(day.cancelledCount || 0) > 0 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200">
                              {day.cancelledCount} cancelled (₹{day.cancelledRevenue} refunded)
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-xs">0 cancelled</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-black text-teal-700 text-sm">
                          ₹{day.revenue}
                        </td>
                        <td className="py-4 px-4 font-semibold text-zinc-800">
                          {day.topService}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            (day.totalBookings || day.totalCustomers) >= 5
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : (day.totalBookings || day.totalCustomers) > 0
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {(day.totalBookings || day.totalCustomers) >= 5 ? 'Peak Day' : (day.totalBookings || day.totalCustomers) > 0 ? 'Steady' : 'Quiet'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* AI EXECUTIVE REVIEW SECTION WITH TRIGGER BUTTON */}
          <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30 px-3 py-1 rounded-full">
                    AI Performance Intelligence
                  </span>
                  <span className="text-xs text-zinc-400">
                    {analytics?.aiInsights?.isAiGenerated ? 'Powered by Google Gemini AI' : 'Deterministic Pacing Engine'}
                  </span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white mt-2">
                  AI Executive Review
                </h3>
                <p className="text-xs text-zinc-300 max-w-xl">
                  Deep analysis of your busiest rush windows, most loyal VIP patron, and top-performing staff member with operational recommendations.
                </p>
              </div>

              {/* THE AI REVIEW BUTTON */}
              <button
                type="button"
                onClick={handleTriggerAIReview}
                disabled={loadingAIReview}
                className="px-6 py-3.5 rounded-2xl bg-teal-400 hover:bg-teal-300 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50 flex-shrink-0"
              >
                {loadingAIReview ? (
                  <>
                    <span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Peak & Staff...</span>
                  </>
                ) : (
                  <span>Generate AI Review</span>
                )}
              </button>
            </div>

            {/* THREE EXECUTIVE REPORT CARDS: PEAK HOURS, BEST CUSTOMER, BEST EMPLOYEE */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 1. PEAK HOURS & CONGESTION */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 px-2.5 py-1 rounded-md">
                      Rush Forecast
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white">Peak Hours Window</h4>
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(analytics?.aiInsights?.peakHours || ['11:00 AM - 1:00 PM', '4:30 PM - 7:00 PM']).map((window, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-200 text-xs font-bold"
                      >
                        {window}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed pt-2">
                    {analytics?.aiInsights?.peakHoursAnalysis ||
                      'Midday and evening slots experience the highest footfall concentration. Keep chairs and consultation rooms fully staffed.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>Cancellation Rate:</span>
                  <strong className="text-teal-300">{analytics?.aiInsights?.cancellationRate || '0%'}</strong>
                </div>
              </div>

              {/* 2. BEST CUSTOMER SPOTLIGHT */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md">
                      {analytics?.aiInsights?.bestCustomer?.badge || 'VIP Regular'}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white">Best Customer</h4>

                  <div className="p-3.5 rounded-xl bg-zinc-800/80 border border-zinc-700/60 space-y-1">
                    <p className="text-sm font-black text-amber-200">
                      {analytics?.aiInsights?.bestCustomer?.name || analytics?.topCustomer?.name || 'Top Regular Patron'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-zinc-300 font-semibold pt-1">
                      <span>{analytics?.aiInsights?.bestCustomer?.visits ?? analytics?.topCustomer?.visits ?? 1} visits</span>
                      <span>•</span>
                      <span className="text-emerald-400">₹{analytics?.aiInsights?.bestCustomer?.totalSpent ?? analytics?.topCustomer?.totalSpent ?? 0} spent</span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed pt-1">
                    {analytics?.aiInsights?.bestCustomer?.review ||
                      'High-frequency patron who values prompt turnaround. Suggest tailored loyalty perks and advance booking reminders.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-zinc-800 text-[11px] text-zinc-400">
                  Retention advice: Priority queueing recommendation
                </div>
              </div>

              {/* 3. BEST EMPLOYEE (BARBER OR DOCTOR) */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-md">
                      {analytics?.aiInsights?.bestEmployee?.badge || (isClinic ? 'Doctor of the Month' : 'Barber of the Month')}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white">Best Employee</h4>

                  <div className="p-3.5 rounded-xl bg-zinc-800/80 border border-zinc-700/60 space-y-1">
                    <p className="text-sm font-black text-indigo-200">
                      {analytics?.aiInsights?.bestEmployee?.name || analytics?.topEmployee?.name || (isClinic ? 'Senior Doctor' : 'Master Barber')}
                    </p>
                    <p className="text-xs text-zinc-400 font-medium">
                      {analytics?.aiInsights?.bestEmployee?.role || analytics?.topEmployee?.role || (isClinic ? 'Consultant' : 'Stylist')}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-zinc-300 font-semibold pt-1">
                      <span>{analytics?.aiInsights?.bestEmployee?.customersServed ?? analytics?.topEmployee?.customersServed ?? 0} served</span>
                      <span>•</span>
                      <span className="text-amber-400">Rating: {analytics?.aiInsights?.bestEmployee?.rating ?? analytics?.topEmployee?.rating ?? 5.0}</span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed pt-1">
                    {analytics?.aiInsights?.bestEmployee?.review ||
                      'Consistently receives high ratings with quick turnarounds and stellar customer satisfaction.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-zinc-800 text-[11px] text-zinc-400">
                  Performance appraisal: Recommended for spotlight
                </div>
              </div>
            </div>

            {/* RECOMMENDATIONS LIST */}
            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <h4 className="text-xs font-black uppercase text-teal-300 tracking-wider">
                Strategic Recommendations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(analytics?.aiInsights?.recommendations || [
                  'Add 15m staff buffer during predicted peak hours.',
                  'Provide loyalty perks for top repeat customer to boost retention.',
                  'Staff utilization pacing is healthy; keep current shift coverage.',
                ]).map((rec, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-zinc-800/70 border border-zinc-700/50 text-xs text-zinc-200 flex items-start gap-2.5"
                  >
                    <span className="text-teal-400 font-bold">✓</span>
                    <span className="leading-relaxed">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  )
}
