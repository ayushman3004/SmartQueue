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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      onClick={() => navigate(isOwner ? `/business/${business._id}/manage` : `/queue/${business._id}`)}
      className="glass-card flex flex-col relative overflow-hidden rounded-2xl cursor-pointer bg-white border border-zinc-200 shadow-md group"
    >
      <div className="h-24 bg-slate-50 flex items-center justify-between px-6 border-b border-zinc-100 relative">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-2xl shadow-xs">
            {CATEGORY_ICONS[business.category] || '🏢'}
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-900 tracking-tight truncate max-w-[180px] group-hover:text-teal-700 transition-colors">
              {business.name}
            </h3>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">
              {business.category}
            </p>
          </div>
        </div>
        
        <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase ${
          business.isOpen ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-rose-100 border-rose-200 text-rose-700'
        }`}>
          {business.isOpen ? 'Open' : 'Closed'}
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1 gap-6">
        {/* Core Stats */}
        <div className="flex bg-slate-100/50 rounded-lg p-4 border border-zinc-100 items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Queue Size</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-zinc-900">{business.queueLength || 0}</span>
              <span className="text-xs text-slate-400 font-bold">PPL</span>
            </div>
          </div>
          <div className="w-px h-10 bg-zinc-200" />
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Est. Delay</p>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-3xl font-black text-teal-600">{business.estimatedWait || 0}</span>
              <span className="text-xs text-slate-400 font-bold">MIN</span>
            </div>
          </div>
        </div>

        {/* Multi-Select Services UI */}
        {!isOwner && business.isOpen && business.services?.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Select Services</span>
              <span className="text-xs font-bold text-teal-600 opacity-80">{totalDuration} min block</span>
            </div>
            
            <div className="flex flex-col gap-2">
              {business.services.map((svc, i) => {
                const isSelected = selectedServices.includes(svc.name)
                return (
                  <button
                    key={`svc-${i}`}
                    type="button"
                    onClick={(e) => toggleService(svc.name, e)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all text-left ${
                      isSelected 
                        ? 'border-teal-200 bg-teal-50 text-teal-900' 
                        : 'border-zinc-100 bg-slate-50 text-slate-600 hover:border-zinc-300 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-teal-600 bg-teal-600' : 'border-zinc-300'}`}>
                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="font-medium truncate max-w-[120px] sm:max-w-auto flex-1">{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold">
                      <span className={isSelected ? "text-teal-700" : "text-slate-400"}>{svc.duration}m</span>
                      {svc.price !== undefined && svc.price >= 0 && (
                        <span className="bg-slate-200 px-2 py-1 rounded">₹{svc.price}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-auto pt-6 flex flex-col gap-4">
          {!isOwner && business.isOpen && (
            <div className="flex justify-between items-center text-sm font-bold text-slate-400">
               <span>Total Price: <span className="text-zinc-900 ml-1">₹{totalPrice}</span></span>
               <span>Slot: <span className="text-teal-700 ml-1">{predictedSlot}</span></span>
            </div>
          )}
          <button
            onClick={handleBookNow}
            disabled={!business.isOpen || booking}
            className={`w-full py-4 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-2 focus:ring-offset-white ${
              !business.isOpen 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-95 shadow-md shadow-teal-600/10'
            }`}
          >
            {(() => {
              if (booking) return 'Processing...';
              if (isOwner) return 'Manage Hub Config';
              return 'Reserve Slot & Join Queue';
            })()}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
