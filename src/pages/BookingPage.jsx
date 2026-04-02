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
  const { user, setUser } = useAuth()
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

      // Update wallet balance from booking response
      if (res.data.data.newBalance !== undefined) {
        setUser(prev => prev ? { ...prev, walletBalance: res.data.data.newBalance } : prev)
      }

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
      <div className="w-10 h-10 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="container py-12 px-4 sm:px-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30, x: '-50%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="fixed top-24 left-1/2 z-50 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl border"
            style={{
              background: toast.type === 'success' ? '#f0fdf4' : toast.type === 'error' ? '#fef2f2' : toast.type === 'warning' ? '#fffbeb' : '#ffffff',
              color: toast.type === 'success' ? '#15803d' : toast.type === 'error' ? '#b91c1c' : toast.type === 'warning' ? '#b45309' : '#09090b',
              borderColor: toast.type === 'success' ? '#dcfce7' : toast.type === 'error' ? '#fee2e2' : toast.type === 'warning' ? '#fef3c7' : '#f4f4f5',
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-10 text-slate-400 hover:text-zinc-950 transition-all px-4 py-2 rounded-xl bg-slate-50 border border-zinc-100 hover:bg-white hover:border-zinc-200">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to Directory
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Business + My Bookings */}
        <div className="lg:col-span-4 space-y-8">
          {/* Business Info */}
          {business && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white border border-zinc-200 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-[40px] pointer-events-none" />
              <h1 className="text-2xl font-black mb-1 text-zinc-950 tracking-tight leading-none uppercase">
                {business.name.split(' ')[0]}<span className="text-teal-600">{business.name.split(' ').slice(1).join(' ')}</span>
              </h1>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-8 text-slate-400">{business.category} Hub Operations</p>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-zinc-100 text-center shadow-xs">
                  <p className="text-lg font-black text-teal-700 leading-none mb-1.5">{meta.avgServiceTime}m</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Avg Time</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-zinc-100 text-center shadow-xs">
                  <p className="text-lg font-black text-indigo-700 leading-none mb-1.5">{meta.aiBuffer}m</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Safety</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-zinc-100 text-center shadow-xs">
                  <p className="text-lg font-black text-rose-700 leading-none mb-1.5">₹{meta.ratePerMinute}</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Extra</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* My Bookings */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white border border-zinc-200 p-8 rounded-[2.5rem] shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] mb-6 text-zinc-950">Active Registrations</h3>
            {myBookings.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest py-8 text-center border border-dashed border-zinc-100 rounded-2xl">Null entries detected.</p>
            ) : (
              <div className="space-y-4">
                {myBookings.map((b) => (
                  <div key={b._id} className="p-5 rounded-3xl relative overflow-hidden bg-slate-50 border border-zinc-200 group hover:border-teal-200 transition-all shadow-xs" style={{ borderLeftWidth: b.delayMinutes > 0 ? '4px' : '1px', borderLeftColor: b.delayMinutes > 0 ? '#f59e0b' : '#e4e4e7' }}>
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <span className="text-[11px] font-black text-zinc-950 tabular-nums">
                        {formatTime(b.startTime)} — {formatTime(b.endTime)}
                      </span>
                      <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border transition-all ${
                        b.status === 'in-progress' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.1)]' :
                        b.status === 'completed' ? 'bg-slate-100 text-slate-500 border-zinc-200' : 'bg-white text-teal-600 border-teal-100'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                    {b.delayMinutes > 0 && (
                      <div className="flex items-center gap-1.5 mb-2 relative z-10">
                        <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">⚠️ {b.delayMinutes}M Extension Added</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-4 relative z-10">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Token ID: {b._id.slice(-8)}</p>
                      {b.status === 'scheduled' && (
                        <button
                          onClick={() => handleCancel(b._id)}
                          className="text-[8px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-700 transition-colors bg-rose-50 px-2 py-1 rounded-md"
                        >Delete Record</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column: Available Slots */}
        <div className="lg:col-span-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-zinc-200 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10 relative z-10">
              <div>
                <h2 className="text-3xl font-black text-zinc-950 uppercase tracking-tighter leading-none mb-1.5">Reserve<span className="text-teal-600">Space</span></h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Select target temporal vector</p>
              </div>
              <div className="relative">
                <input
                  id="booking-date-picker"
                  type="date"
                  className="input w-auto bg-slate-50 border-zinc-200 text-sm font-black py-4 px-6 rounded-2xl focus:bg-white transition-all shadow-xs"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setLoading(true) }}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* AI Buffer indicator */}
            {meta.aiBuffer > 0 && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-8 p-5 rounded-2xl flex items-center gap-4 bg-teal-50 border border-teal-100 relative z-10 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shadow-xs">🧠</div>
                <div>
                  <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest mb-0.5">Predictive Buffer Active</p>
                  <p className="text-[10px] font-bold text-teal-600 leading-relaxed uppercase opacity-80">
                    AI optimized network latency by {meta.aiBuffer}m based on recent node activity.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Slot Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 relative z-10">
              {slots.map((slot, i) => {
                const isPast = new Date(slot.startTime) < new Date()
                const isAvailable = slot.available && !isPast
                const isSelected = selectedSlot?.startTime === slot.startTime

                return (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.01 }}
                    disabled={!isAvailable || booking}
                    onClick={() => handleBook(slot)}
                    className="p-6 rounded-[1.75rem] text-center transition-all duration-300 relative overflow-hidden group border shadow-xs"
                    style={{
                      background: isSelected ? '#09090b' : isAvailable ? '#f8fafc' : '#ffffff',
                      borderColor: isSelected ? '#09090b' : isAvailable ? '#f1f5f9' : '#f4f4f5',
                      opacity: isAvailable ? 1 : 0.5,
                      color: isSelected ? '#ffffff' : isAvailable ? '#09090b' : '#94a3b8',
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                    }}
                    whileHover={isAvailable ? { scale: 1.05, y: -4, borderColor: '#cbd5e1' } : {}}
                    whileTap={isAvailable ? { scale: 0.95 } : {}}
                  >
                    {isSelected && !booking && <div className="absolute inset-0 bg-teal-500/10 animate-pulse" />}
                    <p className="text-sm font-black tabular-nums tracking-tight mb-1">{formatTime(slot.startTime)}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">
                      {slot.duration}m Limit
                    </p>
                    {!isAvailable && !isPast && (
                      <div className="mt-3 text-[7px] font-black px-2 py-0.5 rounded-md bg-rose-50 text-rose-500 border border-rose-100 uppercase tracking-[0.2em] w-fit mx-auto">Occupied</div>
                    )}
                    {isPast && (
                      <div className="mt-3 text-[7px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 border border-zinc-100 uppercase tracking-[0.2em] w-fit mx-auto">Expired</div>
                    )}
                    {isSelected && booking && (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </motion.button>
                )
              })}
            </div>

            {slots.length === 0 && (
              <div className="text-center py-20 bg-slate-50/50 rounded-[2.5rem] mt-4 border border-dashed border-zinc-200">
                <p className="text-5xl mb-6 opacity-20">🏜️</p>
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Temporal Vacuum Detected</p>
                <p className="text-[10px] mt-2 font-bold text-slate-300 uppercase">Try shifting target date.</p>
              </div>
            )}

            {/* Legend */}
            <div className="mt-10 pt-10 border-t border-zinc-100 flex flex-wrap items-center gap-8 justify-center sm:justify-start" style={{ color: '#94a3b8' }}>
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-lg bg-slate-100 border border-slate-200" />
                <span className="text-[9px] font-black uppercase tracking-widest">Available Nodes</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-lg bg-white border border-zinc-100 opacity-50" />
                <span className="text-[9px] font-black uppercase tracking-widest">Restricted Space</span>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <span className="text-sm">⚡</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-teal-600">±10M Flexibility Window Adaptive</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
