import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const CATEGORY_ICONS = {
  healthcare: '🏥',
  banking: '🏦',
  retail: '🛍️',
  restaurant: '🍽️',
  government: '🏛️',
  other: '🏢',
}

export default function BusinessCard({ business, index }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [booking, setBooking] = useState(false)

  const isOwner = user?.role === 'owner' && business.owner?._id?.toString() === user._id?.toString()

  const handleBookNow = async (e) => {
    e.stopPropagation()
    if (isOwner) {
      navigate(`/business/${business._id}/manage`)
      return
    }

    setBooking(true)
    try {
      // Direct join queue logic
      const response = await api.post(`/queue/${business._id}/join`, {
        serviceType: 'general',
      })
      if (response.data.success) {
        navigate(`/queue/${business._id}`)
      }
    } catch (err) {
      console.error('Booking failed:', err)
      // If already in queue, just navigate
      if (err.response?.status === 400 || err.response?.data?.message?.includes('already')) {
        navigate(`/queue/${business._id}`)
      } else {
        alert(err.response?.data?.message || 'Failed to join queue')
      }
    } finally {
      setBooking(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.5 }}
      whileHover={{ y: -6 }}
      onClick={() => navigate(isOwner ? `/business/${business._id}/manage` : `/queue/${business._id}`)}
      className="glass cursor-pointer p-6 flex flex-col gap-5 relative overflow-hidden group"
    >
      {/* Background glow accent */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 pointer-events-none transition-opacity group-hover:opacity-10"
        style={{ background: 'var(--cyan)', filter: 'blur(40px)', transform: 'translate(30%, -30%)' }} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl glass-bright bg-linear-to-br from-white/10 to-transparent">
            {CATEGORY_ICONS[business.category] || '🏢'}
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight group-hover:text-cyan-400 transition-colors" style={{ color: 'var(--text-primary)' }}>
              {business.name}
            </h3>
            <p className="text-xs mt-1 font-medium tracking-wide uppercase opacity-50" style={{ color: 'var(--text-secondary)' }}>
              {business.category}
            </p>
          </div>
        </div>
        <span className={business.isOpen ? 'badge-open' : 'badge-closed'}>
          <span className={business.isOpen ? 'pulse-dot mr-1' : ''}></span>
          {business.isOpen ? 'Live' : 'Closed'}
        </span>
      </div>

      {/* Real-time Analytics Overlay */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <p className="text-[10px] font-bold uppercase opacity-40 mb-1" style={{ color: 'var(--text-secondary)' }}>Current Queue</p>
          <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
            {business.queueLength || 0} <span className="text-xs font-normal opacity-50">people</span>
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <p className="text-[10px] font-bold uppercase opacity-40 mb-1" style={{ color: 'var(--text-secondary)' }}>Wait Time</p>
          <p className="text-xl font-black" style={{ color: 'var(--cyan)' }}>
            {business.estimatedWait || 0} <span className="text-xs font-normal opacity-50 text-white">mins</span>
          </p>
        </div>
      </div>

      {/* Description */}
      {business.description && (
        <p className="text-sm leading-relaxed line-clamp-2 opacity-70" style={{ color: 'var(--text-secondary)' }}>
          {business.description}
        </p>
      )}

      {/* Action Button */}
      <button
        onClick={handleBookNow}
        disabled={!business.isOpen || booking}
        className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
          !business.isOpen 
            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            : 'bg-linear-to-r from-cyan-500 to-blue-600 text-black shadow-lg shadow-cyan-500/20'
        }`}
      >
        {booking ? (
          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        ) : isOwner ? (
          'Manage Dashboard'
        ) : (
          <>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Book Now
          </>
        )}
      </button>
    </motion.div>
  )
}
