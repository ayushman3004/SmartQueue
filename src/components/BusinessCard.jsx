import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [isHovered, setIsHovered] = useState(false)
  const [selectedPricing, setSelectedPricing] = useState(business.pricing?.[0]?.label || "")

  const isOwner = user?.role === 'owner' && (business.owner?._id || business.owner)?.toString() === user._id?.toString()

  useEffect(() => {
    if (!socket) return
    
    const handleQueueUpdate = (updatedQueue) => {
      if (updatedQueue._id === business._id || updatedQueue.businessId === business._id) {
        setBusiness(prev => ({
          ...prev,
          queueLength: updatedQueue.users.length,
          estimatedWait: updatedQueue.users.length * (prev.averageServiceTime || 10)
        }))
      }
    }

    const handleStatusUpdate = (data) => {
      if (data.businessId === business._id || data.businessId === business._id?.toString()) {
        setBusiness(prev => ({
          ...prev,
          isOpen: data.isOpen
        }))
      }
    }

    socket.on('queue:update', handleQueueUpdate)
    socket.on('business:status', handleStatusUpdate)
    
    return () => {
      socket.off('queue:update', handleQueueUpdate)
      socket.off('business:status', handleStatusUpdate)
    }
  }, [socket, business._id])

  const predictedSlot = new Date(Date.now() + (business.estimatedWait || 0) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const handleBookNow = async (e) => {
    e.stopPropagation()
    if (isOwner) {
      navigate(`/business/${business._id}/manage`)
      return
    }

    setBooking(true)
    try {
      const response = await api.post(`/queue/${business._id}/join`, {
        serviceType: 'general',
        pricingLabel: selectedPricing
      })
      if (response.data.success) {
        toast.success(`Joined ${business.name}!`, {
          style: { borderRadius: '16px', background: '#111', color: '#fff', border: '1px solid #06b6d4' }
        })
        setTimeout(() => navigate(`/queue/${business._id}`), 800)
      }
    } catch (err) {
      if (err.response?.status === 400 || err.response?.data?.message?.includes('already')) {
        navigate(`/queue/${business._id}`)
      } else {
        toast.error(err.response?.data?.message || 'Failed to join')
      }
    } finally {
      setBooking(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -8 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => navigate(isOwner ? `/business/${business._id}/manage` : `/queue/${business._id}`)}
      className="glass-card group flex flex-col relative overflow-hidden rounded-[2.5rem]"
    >
      {/* Visual Header Image/Color */}
      <div className="h-40 relative overflow-hidden">
        <div className={`absolute inset-0 bg-linear-to-br transition-all duration-700 ${
          isHovered ? 'from-cyan-500/40 via-blue-500/40 to-indigo-600/40' : 'from-cyan-900/20 to-neutral-900/40'
        }`} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-3xl glass-bright flex items-center justify-center text-5xl shadow-2xl group-hover:scale-110 transition-transform duration-500">
            {CATEGORY_ICONS[business.category] || '🏢'}
          </div>
        </div>
        
        {/* Hub Info Overlay */}
        <div className="absolute top-6 right-6">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl glass-bright text-[10px] font-black uppercase tracking-widest ${
            business.isOpen ? 'text-emerald-400' : 'text-neutral-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${business.isOpen ? 'bg-emerald-500 animate-pulse shadow-emerald-500' : 'bg-neutral-600'}`} />
            {business.isOpen ? 'Live' : 'Closed'}
          </div>
        </div>
      </div>

      <div className="p-8 flex flex-col flex-1 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-black text-white group-hover:text-cyan-400 transition-colors tracking-tight">
              {business.name}
            </h3>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">
            {business.category} hub · {business.averageServiceTime}m avg
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-bright bg-white/5 p-4 rounded-3xl border border-white/5 space-y-1">
            <span className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">In Queue</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">{business.queueLength || 0}</span>
              <span className="text-[8px] font-bold text-neutral-600">CLI</span>
            </div>
          </div>
          <div className="glass-bright bg-white/5 p-4 rounded-3xl border border-white/5 space-y-1">
            <span className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Wait Time</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-cyan-400">{business.estimatedWait || 0}</span>
              <span className="text-[8px] font-bold text-neutral-600">MINS</span>
            </div>
          </div>
        </div>

        {/* Dynamic Pricing */}
        {!isOwner && business.isOpen && business.pricing?.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {business.pricing.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setSelectedPricing(p.label) }}
                className={`p-3 rounded-2xl text-[9px] font-black uppercase border transition-all ${
                  selectedPricing === p.label 
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400 shadow-xl shadow-cyan-500/10' 
                    : 'border-white/5 bg-white/5 text-neutral-500 hover:border-white/20'
                }`}
              >
                {p.label} · ₹{p.price}
              </button>
            ))}
          </div>
        )}

        {/* AI Prediction Footer */}
        <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex -space-x-3 overflow-hidden">
            {[1,2,3].map(j => (
              <div key={j} className="inline-block h-8 w-8 rounded-full ring-4 ring-[#0F1419] bg-neutral-800 border border-white/10" />
            ))}
            <div className="flex items-center justify-center h-8 w-8 rounded-full ring-4 ring-[#0F1419] bg-cyan-500/10 border border-cyan-500/20 text-[8px] font-black text-cyan-400">
              +{business.queueLength > 3 ? business.queueLength - 3 : 0}
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest mb-0.5">Estimated Slot</p>
            <p className="text-xs font-black text-white">{predictedSlot}</p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleBookNow}
          disabled={!business.isOpen || booking}
          className={`w-full py-5 rounded-[1.75rem] font-black uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 group/btn relative overflow-hidden ${
            !business.isOpen 
              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              : 'bg-linear-to-r from-cyan-500 to-blue-600 text-black shadow-2xl shadow-cyan-500/20'
          }`}
        >
          <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
          <span className="relative z-10">
            {booking ? 'Processing...' : isOwner ? 'Manage Hub' : `Join Queue · ₹${business.pricing?.find(p => p.label === selectedPricing)?.price || business.basePrice || 0}`}
          </span>
        </button>
      </div>
    </motion.div>
  )
}
