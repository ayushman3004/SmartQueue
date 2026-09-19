import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import api from '../api/axios'

const CATEGORY_ICONS = {
  healthcare: '🏥',
  banking: '🏦',
  retail: '🛍️',
  salon: '💇',
  restaurant: '🍽️',
  government: '🏛️',
  other: '🏢',
}

export default function BusinessCard({ business: initialBusiness, index }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { socket } = useSocket()
  const [business, setBusiness] = useState(initialBusiness)
  const [booking, setBooking] = useState(false)
  const [selectedServices, setSelectedServices] = useState([business.services?.[0]?.name || "general"])

  const isOwner = user?.role === 'owner' && (business.owner?._id || business.owner)?.toString() === user._id?.toString()

  useEffect(() => {
    if (!socket) return;
    const handleQueueUpdate = (updatedQueue) => {
      if (updatedQueue._id === business._id || updatedQueue.businessId === business._id) {
        const users = updatedQueue.users || [];
        let waitMins = 0;
        if (users.length > 0) {
          const lastUser = users[users.length - 1];
          const buffer = 15;
          const lastEndTime = new Date(new Date(lastUser.estimatedStartTime).getTime() + (lastUser.serviceTime + buffer) * 60000);
          waitMins = Math.max(0, Math.round((lastEndTime - new Date()) / 60000));
        }
        setBusiness(prev => ({
          ...prev,
          queueLength: users.length,
          estimatedWait: waitMins
        }));
      }
    }
    const handleStatusUpdate = (data) => {
      if (data.businessId === business._id || data.businessId === business._id?.toString()) {
        setBusiness(prev => ({ ...prev, isOpen: data.isOpen }))
      }
    }

    socket.on('queue:update', handleQueueUpdate)
    socket.on('business:status', handleStatusUpdate)
    return () => {
      socket.off('queue:update', handleQueueUpdate)
      socket.off('business:status', handleStatusUpdate)
    }
  }, [socket, business._id])

  const toggleService = (name, e) => {
    e.stopPropagation()
    setSelectedServices(prev => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(s => s !== name)
      }
      return [...prev, name]
    })
  }

  // Compute Selected Totals
  const selectedObjects = (business.services || []).filter(s => selectedServices.includes(s.name))
  const totalDuration = selectedObjects.reduce((acc, curr) => acc + (curr.duration || 15), 0) || business.averageServiceTime
  let totalPrice = selectedObjects.reduce((acc, curr) => {
    const p = curr.price !== undefined && curr.price >= 0 ? curr.price : (business.basePrice || 0)
    return acc + p
  }, 0)

  // Fallback if no services exist
  if (selectedObjects.length === 0) {
    totalPrice = business.basePrice || 0
  }

  // Slot is the START time for the new booking
  const predictedSlot = new Date(Date.now() + (business.estimatedWait || 0) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const handleBookNow = async (e) => {
    e.stopPropagation()
    if (isOwner) {
      navigate(`/business/${business._id}/manage`)
      return
    }

    setBooking(true)
    try {
      // Backend expects a single string for serviceType to not break schema logic. We join them.
      const joinedServices = selectedServices.join(', ')
      const response = await api.post(`/queue/${business._id}/join`, {
        serviceType: joinedServices,
      })
      if (response.data.success) {
        toast.success(`Joined ${business.name}!`, {
          style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #f4f4f5' }
        })
        setTimeout(() => navigate(`/queue/${business._id}`), 800)
      }
    } catch (err) {
      if (err.response?.status === 400 || err.response?.data?.message?.includes('already')) {
        navigate(`/queue/${business._id}`)
      } else {
        toast.error(err.response?.data?.message || 'Failed to join', {
          style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #fef2f2' }
        })
      }
    } finally {
      setBooking(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      onClick={() => navigate(isOwner ? `/business/${business._id}/manage` : `/queue/${business._id}`)}
      className="bezel-shell flex flex-col relative cursor-pointer group text-left"
    >
      <div className="bezel-core flex flex-col flex-1 p-5 md:p-6 overflow-hidden">
        {/* Header with Machined Tile Icon & Status */}
        <div className="flex items-center justify-between gap-3 pb-5 border-b border-zinc-100">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-center text-2xl shadow-xs group-hover:scale-105 transition-transform duration-200 flex-shrink-0">
              {CATEGORY_ICONS[business.category] || '🏢'}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-zinc-950 tracking-tight truncate group-hover:text-teal-700 transition-colors">
                {business.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 truncate">
                  {business.category} Hub
                </span>
                {business.location && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-zinc-300" />
                    <span className="text-[10px] font-medium text-zinc-400 truncate max-w-[110px]">
                      {business.location}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex-shrink-0 border ${
            business.isOpen 
              ? 'bg-emerald-50 border-emerald-200/80 text-emerald-700 shadow-xs' 
              : 'bg-zinc-100 border-zinc-200 text-zinc-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${business.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
            {business.isOpen ? 'Live' : 'Closed'}
          </div>
        </div>

        {/* Core Stats (Double-Bezel Sub-Card) */}
        <div className="my-5 grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/60 shadow-inner">
          <div className="px-2">
            <p className="text-[10px] font-extrabold uppercase text-zinc-500 tracking-wider mb-0.5">Live Waiting</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-zinc-950 tracking-tight">{business.queueLength || 0}</span>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Patrons</span>
            </div>
          </div>
          <div className="px-2 border-l border-zinc-200/80 text-right">
            <p className="text-[10px] font-extrabold uppercase text-zinc-500 tracking-wider mb-0.5">Est. Turnaround</p>
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="text-2xl font-black text-teal-600 tracking-tight">{business.estimatedWait || 0}</span>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Mins</span>
            </div>
          </div>
        </div>

        {/* Multi-Select Services UI */}
        {!isOwner && business.isOpen && business.services?.length > 0 && (
          <div className="flex flex-col gap-2.5 mb-5">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="uppercase text-zinc-500 tracking-wider">Available Services</span>
              <span className="text-teal-700 font-extrabold">{totalDuration} min block</span>
            </div>
            
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
              {business.services.map((svc, i) => {
                const isSelected = selectedServices.includes(svc.name)
                return (
                  <button
                    key={`svc-${i}`}
                    type="button"
                    onClick={(e) => toggleService(svc.name, e)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs transition-all text-left active:scale-[0.99] ${
                      isSelected 
                        ? 'border-teal-300 bg-teal-50/70 text-teal-950 font-bold shadow-xs' 
                        : 'border-zinc-200/80 bg-white text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                        isSelected ? 'border-teal-600 bg-teal-600 text-white' : 'border-zinc-300 bg-zinc-50'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 stroke-current stroke-3" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="truncate">{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-bold flex-shrink-0 ml-2">
                      <span className="text-[10px] text-zinc-400">{svc.duration}m</span>
                      {svc.price !== undefined && svc.price >= 0 && (
                        <span className="text-xs font-black text-teal-800 bg-teal-100/60 px-2 py-0.5 rounded-md">
                          ₹{svc.price}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Pricing Summary & Action CTA Button */}
        <div className="mt-auto pt-4 border-t border-zinc-100 flex flex-col gap-3">
          {!isOwner && business.isOpen && (
            <div className="flex justify-between items-center text-xs font-bold text-zinc-500">
              <span>Total: <strong className="text-zinc-950 font-black text-sm ml-1">₹{totalPrice}</strong></span>
              <span>Next Ready: <strong className="text-teal-700 font-extrabold ml-1">{predictedSlot}</strong></span>
            </div>
          )}

          <button
            onClick={handleBookNow}
            disabled={!business.isOpen || booking}
            className={`w-full group/btn relative flex items-center justify-between p-1.5 pl-5 rounded-full font-bold text-xs transition-all active:scale-[0.97] ${
              !business.isOpen 
                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
                : isOwner
                  ? 'bg-zinc-950 text-white hover:bg-zinc-900 shadow-md'
                  : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md shadow-teal-600/20'
            }`}
          >
            <span className="tracking-wide">
              {booking ? 'Joining Room...' : isOwner ? 'Open Operations Console' : 'Reserve & Join Live Queue'}
            </span>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-200 group-hover/btn:translate-x-0.5 ${
              !business.isOpen ? 'bg-zinc-200 text-zinc-400' : 'bg-white/20 text-white'
            }`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}
