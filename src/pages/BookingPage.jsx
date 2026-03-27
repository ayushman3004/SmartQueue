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

export default function BookingPage() {
  const { businessId } = useParams()
  const { user } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()

  const [business, setBusiness] = useState(null)
  const [slots, setSlots] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [meta, setMeta] = useState({ avgServiceTime: 10, aiBuffer: 0, ratePerMinute: 20 })
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [toast, setToast] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [bRes, sRes, mRes] = await Promise.all([
        getBusiness(businessId),
        getAvailableSlots(businessId, selectedDate),
        getMyBookings(),
      ])
      setBusiness(bRes.data.data.business)
      setSlots(sRes.data.data.slots)
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
  }, [businessId, selectedDate])

  useEffect(() => { fetchData() }, [fetchData])

  // Socket: listen for delay notifications
  useEffect(() => {
    if (!socket) return
    const handleDelay = (data) => {
      if (data.userId === user?._id) {
        showToast(`⏱️ ${data.message}`, 'warning')
        fetchData() // refresh bookings
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

  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  const handleBook = async (slot) => {
    setBooking(true)
    setSelectedSlot(slot)
    try {
      const res = await createBooking({
        businessId,
        startTime: slot.startTime,
        serviceType: 'general',
      })
      const msg = res.data.message
      console.log('📅 Booking response:', res.data.data)
      showToast(`✅ ${msg}`, 'success')
      fetchData()
    } catch (err) {
      showToast(`❌ ${err.response?.data?.message || 'Booking failed'}`, 'error')
    } finally {
      setBooking(false)
      setSelectedSlot(null)
    }
  }

  const handleCancel = async (id) => {
    try {
      await cancelBooking(id)
      showToast('Booking cancelled', 'info')
      fetchData()
    } catch (err) {
      showToast(`❌ ${err.response?.data?.message || 'Cancel failed'}`, 'error')
    }
  }

  const formatTime = (iso) => {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <div className="w-10 h-10 border-2 border-[var(--cyan)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="container py-10">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30, x: '-50%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="fixed top-20 left-1/2 z-50 px-6 py-3 rounded-xl text-sm font-semibold shadow-lg"
            style={{
              background: toast.type === 'success' ? 'var(--green-dim)' : toast.type === 'error' ? 'rgba(255,82,82,0.15)' : toast.type === 'warning' ? 'var(--amber-dim)' : 'var(--bg-elevated)',
              color: toast.type === 'success' ? 'var(--green)' : toast.type === 'error' ? 'var(--red)' : toast.type === 'warning' ? 'var(--amber)' : 'var(--cyan)',
              border: `1px solid ${toast.type === 'success' ? 'rgba(0,230,118,0.3)' : toast.type === 'error' ? 'rgba(255,82,82,0.3)' : toast.type === 'warning' ? 'rgba(255,179,0,0.3)' : 'var(--border-bright)'}`,
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm mb-6"
        style={{ color: 'var(--text-secondary)' }}>
        ← Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Business + My Bookings */}
        <div className="lg:col-span-1 space-y-5">
          {/* Business Info */}
          {business && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass p-6">
              <h1 className="text-xl font-black mb-1" style={{ color: 'var(--text-primary)' }}>{business.name}</h1>
              <p className="text-xs mb-4 capitalize" style={{ color: 'var(--text-muted)' }}>{business.category}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-base)' }}>
                  <p className="text-lg font-black gradient-text">{meta.avgServiceTime}m</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Avg Time</p>
                </div>
                <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-base)' }}>
                  <p className="text-lg font-black gradient-text">{meta.aiBuffer}m</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>AI Buffer</p>
                </div>
                <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-base)' }}>
                  <p className="text-lg font-black gradient-text-amber">₹{meta.ratePerMinute}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>/min extra</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* My Bookings */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass p-6">
            <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>📋 My Bookings</h3>
            {myBookings.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No bookings yet.</p>
            ) : (
              <div className="space-y-3">
                {myBookings.map((b) => (
                  <div key={b._id} className="p-3 rounded-lg relative" style={{ background: 'var(--bg-base)', border: `1px solid ${b.delayMinutes > 0 ? 'rgba(255,179,0,0.3)' : 'var(--border)'}` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatTime(b.startTime)} - {formatTime(b.endTime)}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        b.status === 'in-progress' ? 'badge-serving' :
                        b.status === 'completed' ? 'badge-open' : 'badge-waiting'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                    {b.delayMinutes > 0 && (
                      <p className="text-[10px] font-semibold" style={{ color: 'var(--amber)' }}>
                        ⚠️ Delayed by {b.delayMinutes} min
                      </p>
                    )}
                    {b.extraCharge > 0 && (
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Extra charge: ₹{b.extraCharge}
                      </p>
                    )}
                    {b.status === 'scheduled' && (
                      <button
                        onClick={() => handleCancel(b._id)}
                        className="text-[10px] font-semibold mt-1"
                        style={{ color: 'var(--red)' }}
                      >Cancel</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column: Available Slots */}
        <div className="lg:col-span-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>📅 Book a Slot</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Select a date and available time slot
                </p>
              </div>
              <input
                id="booking-date-picker"
                type="date"
                className="input w-auto"
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setLoading(true) }}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* AI Buffer indicator */}
            {meta.aiBuffer > 0 && (
              <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{
                background: 'linear-gradient(135deg, rgba(0,229,255,0.06), rgba(123,97,255,0.06))',
                border: '1px solid rgba(0,229,255,0.15)',
              }}>
                <span>🧠</span>
                <span className="text-xs" style={{ color: 'var(--cyan)' }}>
                  AI added {meta.aiBuffer}-min buffer between slots based on recent extension patterns
                </span>
              </div>
            )}

            {/* Slot Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {slots.map((slot, i) => {
                const isPast = new Date(slot.startTime) < new Date()
                const isAvailable = slot.available && !isPast
                const isSelected = selectedSlot?.startTime === slot.startTime

                return (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    disabled={!isAvailable || booking}
                    onClick={() => handleBook(slot)}
                    className="p-3 rounded-xl text-center transition-all duration-200 relative overflow-hidden"
                    style={{
                      background: isSelected ? 'linear-gradient(135deg, var(--cyan), #7B61FF)' :
                        isAvailable ? 'var(--bg-elevated)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isAvailable ? 'var(--border-bright)' : 'var(--border)'}`,
                      opacity: isAvailable ? 1 : 0.4,
                      color: isSelected ? '#000' : isAvailable ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                    }}
                    whileHover={isAvailable ? { scale: 1.03, y: -2 } : {}}
                    whileTap={isAvailable ? { scale: 0.97 } : {}}
                  >
                    <p className="text-sm font-bold">{formatTime(slot.startTime)}</p>
                    <p className="text-[10px] mt-0.5" style={{ opacity: 0.7 }}>
                      {slot.duration} min
                    </p>
                    {!isAvailable && !isPast && (
                      <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--red)', opacity: 1 }}>Booked</p>
                    )}
                    {isPast && (
                      <p className="text-[10px] font-semibold mt-0.5" style={{ opacity: 0.5 }}>Past</p>
                    )}
                    {isSelected && booking && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </motion.button>
                )
              })}
            </div>

            {slots.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">📭</p>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>No slots available</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Try a different date</p>
              </div>
            )}

            {/* Flex Range Legend */}
            <div className="mt-4 flex items-center gap-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)' }} />
                Available
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }} />
                Booked / Past
              </div>
              <div className="flex items-center gap-1.5">
                <span>⚡</span>
                ±{10} min flexible booking
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
