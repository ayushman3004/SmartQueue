import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getQueue, callNext, extendUserTime } from '../api/queue.api'
import { getBusiness, updateBusiness, toggleBusiness } from '../api/business.api'
import {
  getBusinessBookings,
  extendBooking,
  startBookingService,
  completeBookingService,
} from '../api/booking.api'
import { getBusinessAnalytics } from '../api/analytics.api'
import { CATEGORY_METADATA, SERVICE_PRESETS } from '../utils/servicePresets'
import { toast } from 'react-hot-toast'

export default function BusinessDashboard() {
  const { businessId } = useParams()
  const { user } = useAuth()
  const { joinAdmin, leaveRoom, onQueueUpdate, socket } = useSocket()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('queue') // 'queue' | 'appointments' | 'profile' | 'analytics'
  const [business, setBusiness] = useState(null)
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
    }

    socket?.on('bookings:updated', handleBookingUpdate)

    return () => {
      leaveRoom(businessId)
      unsub?.()
      socket?.off('bookings:updated', handleBookingUpdate)
    }
  }, [businessId, fetchDashboardData, joinAdmin, leaveRoom, onQueueUpdate, socket])

  // Load analytics when analytics tab is opened
  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) {
      getBusinessAnalytics(businessId)
        .then(res => setAnalytics(res.data.data))
        .catch(err => toast.error(err.response?.data?.message || "Failed to load analytics"))
    }
  }, [activeTab, businessId, analytics])

  const handleCallNext = async () => {
    if (!queue?.users?.length) return
    setCalling(true)
    try {
      const res = await callNext(businessId)
      setQueue(res.data.data.queue)
      toast.success('Called next customer')
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
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start service")
    }
  }

  const handleCompleteBooking = async (id) => {
    try {
      await completeBookingService(id)
      toast.success("Service completed!")
      fetchDashboardData()
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const users = queue?.users || []
  const serving = users.find(u => u.status === 'serving')

  return (
    <div className="container max-w-7xl pt-8 pb-20 px-4 sm:px-6 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-200 pb-6">
        <div>
          <button
            onClick={() => navigate('/')}
            className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-zinc-950 mb-3 flex items-center gap-1"
          >
            ← Back to Overview
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-2xl font-black text-teal-800">
              {business?.name?.[0]}
            </div>
            <div>
              <h1 className="text-3xl font-black text-zinc-950 tracking-tight">{business?.name}</h1>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                <span className="capitalize">{business?.category}</span>
                <span>•</span>
                <span>{business?.address || 'No address set'}</span>
                <span>•</span>
                <span className={`font-bold ${business?.isOpen ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {business?.isOpen ? '● OPEN' : '○ CLOSED'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleOpen}
            disabled={toggling || !business?.isActive}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs border transition-all ${
              !business?.isActive
                ? 'bg-zinc-100 text-slate-400 cursor-not-allowed'
                : business?.isOpen
                ? 'bg-white border-zinc-200 text-rose-600 hover:bg-rose-50'
                : 'bg-teal-600 text-white border-teal-500 hover:bg-teal-700'
            }`}
          >
            {toggling ? 'Updating...' : business?.isOpen ? 'Close Services' : 'Open Services'}
          </button>
          <button
            onClick={handleCallNext}
            disabled={calling || users.length === 0}
            className="px-6 py-2.5 rounded-xl bg-zinc-950 text-white font-bold text-xs hover:bg-zinc-800 disabled:opacity-40 transition-all flex items-center gap-2"
          >
            {calling ? 'Processing...' : 'Serve Next in Queue ⏭'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto custom-scrollbar">
        {[
          { id: 'queue', label: 'Live Queue & Floor', count: users.length },
          { id: 'appointments', label: 'Appointments', count: bookings.length },
          { id: 'services', label: 'Services Catalog', count: profileForm.services?.length || 0 },
          { id: 'profile', label: 'Hub Settings' },
          { id: 'analytics', label: 'AI Analytics & Revenue' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === tab.id ? 'bg-teal-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
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
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border ${
                  serving ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-slate-100 border-zinc-200 text-slate-400'
                }`}>
                  {serving ? '⚡' : '💤'}
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
                      <td className="py-4 px-4 font-medium">{b.serviceType}</td>
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
                  <span>⚡</span> Load Standard Presets
                </button>
                <button
                  type="button"
                  onClick={handleSaveServicesOnly}
                  disabled={savingServices}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingServices ? 'Deploying...' : 'Save & Deploy 💾'}
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
                            ⏱ {svc.duration} mins
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
                  'Deploy & Save All Services 🚀'
                )}
              </button>
            </div>
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
                  {['healthcare', 'banking', 'retail', 'salon', 'restaurant', 'government', 'other'].map(cat => (
                    <option key={cat} value={cat}>{cat.toUpperCase()}</option>
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
        <div className="space-y-8">
          {/* Revenue & Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-400">Total Revenue</p>
              <p className="text-3xl font-black text-teal-700 mt-2">₹{analytics?.metrics?.totalRevenue ?? 0}</p>
              <p className="text-[10px] text-slate-400 mt-1">From completed sessions</p>
            </div>

            <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-400">Unique Customers</p>
              <p className="text-3xl font-black text-zinc-950 mt-2">{analytics?.metrics?.customerCount ?? 0}</p>
              <p className="text-[10px] text-slate-400 mt-1">Served in platform</p>
            </div>

            <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-400">Completed Visits</p>
              <p className="text-3xl font-black text-indigo-700 mt-2">{analytics?.metrics?.completedBookings ?? 0}</p>
              <p className="text-[10px] text-slate-400 mt-1">Total completed appointments</p>
            </div>

            <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-400">Customer Rating</p>
              <p className="text-3xl font-black text-amber-500 mt-2">{analytics?.metrics?.averageRating ?? 5.0} ★</p>
              <p className="text-[10px] text-slate-400 mt-1">{analytics?.metrics?.reviewCount ?? 0} reviews</p>
            </div>
          </div>

          {/* AI Insights & Predictions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-zinc-200 p-8 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-zinc-950 flex items-center gap-2">
                  <span>🧠</span> AI Peak Hours & Traffic Prediction
                </h3>
                <span className="text-[10px] font-bold bg-teal-50 text-teal-800 px-2.5 py-1 rounded-md border border-teal-200">
                  {analytics?.aiInsights?.isAiGenerated ? 'Gemini AI' : 'Deterministic Engine'}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-zinc-100 space-y-2">
                <p className="text-xs font-bold uppercase text-slate-500">Predicted Peak Intervals</p>
                <div className="flex flex-wrap gap-2">
                  {(analytics?.aiInsights?.peakHours || ['11:00 AM - 1:00 PM', '4:00 PM - 7:00 PM']).map((window, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-xl bg-teal-100 text-teal-800 text-xs font-bold">
                      ⏰ {window}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-zinc-100">
                <p className="text-xs font-bold uppercase text-slate-500 mb-1">Cancellation Trend Analysis</p>
                <p className="text-sm font-black text-zinc-900">
                  Cancellation Rate: {analytics?.aiInsights?.cancellationRate || '0%'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Queue pacing remains calibrated within nominal limits.
                </p>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 p-8 rounded-3xl shadow-sm space-y-4">
              <h3 className="text-base font-black text-zinc-950 flex items-center gap-2">
                <span>💬</span> Customer Sentiment & Action Items
              </h3>
              <div className="p-4 rounded-2xl bg-slate-50 border border-zinc-100 space-y-2">
                <p className="text-xs font-bold uppercase text-slate-500">Sentiment Overview</p>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {analytics?.aiInsights?.sentimentSummary || 'Positive feedback across service categories.'}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-slate-500">Operational Recommendations</p>
                <div className="space-y-2">
                  {(analytics?.aiInsights?.recommendations || [
                    'Peak hours predicted during midday; staff buffer times adjusted.',
                    'Turnaround pacing is healthy.',
                    'Keep available slots aligned with average service duration.'
                  ]).map((rec, i) => (
                    <div key={i} className="p-3 rounded-xl bg-teal-50/50 border border-teal-100 text-xs text-teal-900 flex items-start gap-2">
                      <span>✓</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
