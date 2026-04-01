import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getQueue, callNext, extendUserTime } from '../api/queue.api'
import { getBusiness, toggleBusiness } from '../api/business.api'
import { toast } from 'react-hot-toast'
import {
  getBusinessBookings,
  extendBooking,
  startBookingService,
  completeBookingService,
} from '../api/booking.api'

export default function BusinessDashboard() {
  const { businessId } = useParams()
  const { user } = useAuth()
  const { joinRoom, joinAdmin, leaveRoom, onQueueUpdate, socket } = useSocket()
  const navigate = useNavigate()

  const [business, setBusiness] = useState(null)
  const [queue, setQueue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [calling, setCalling] = useState(false)
  const [toggling, setToggling] = useState(false)

  const fetchQueue = useCallback(async () => {
    try {
      const qRes = await getQueue(businessId)
      setQueue(qRes.data.data.queue)
    } catch {}
  }, [businessId])

  useEffect(() => {
    Promise.all([
      getBusiness(businessId),
      getQueue(businessId).catch(() => ({ data: { data: { queue: { users: [] } } } })),
    ]).then(([bRes, qRes]) => {
      const biz = bRes.data.data.business
      if (biz.owner._id?.toString() !== user?._id?.toString() &&
          biz.owner?.toString() !== user?._id?.toString()) {
        navigate('/')
        return
      }
      setBusiness(biz)
      setQueue(qRes.data.data.queue)
    }).catch(() => navigate('/')).finally(() => setLoading(false))

    joinAdmin(businessId)
    const unsub = onQueueUpdate(setQueue)
    return () => { leaveRoom(businessId); unsub?.() }
  }, [businessId, user, navigate, joinAdmin, leaveRoom, onQueueUpdate])

  const showToast = (msg, type = 'info') => {
    if (type === 'error') {
      toast.error(msg, { style: { borderRadius: '12px', background: '#18181b', color: '#fff', border: '1px solid #f43f5e' } })
    } else {
      toast.success(msg, { style: { borderRadius: '12px', background: '#18181b', color: '#fff', border: '1px solid #14b8a6' } })
    }
  }

  const handleCallNext = async () => {
    if (queue?.users?.length === 0) return
    setCalling(true)
    try {
      const res = await callNext(businessId)
      setQueue(res.data.data.queue)
      showToast('Successfully called next customer', 'success')
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to call next', 'error')
    } finally {
      setCalling(false)
    }
  }

  const handleExtend = async (userId, mins) => {
    try {
      const res = await extendUserTime(businessId, userId, mins)
      setQueue(res.data.data.queue)
      showToast(`Extended by ${mins}m`, 'success')
    } catch (err) {
      showToast('Error extending time', 'error')
    }
  }

  const handleToggle = async () => {
    setToggling(true)
    try {
      const res = await toggleBusiness(businessId)
      setBusiness(res.data.data.business)
      showToast(`Business is now ${res.data.data.business.isOpen ? 'OPEN' : 'CLOSED'}`, 'success')
    } catch (err) {
      showToast('Error toggling status', 'error')
    } finally {
      setToggling(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] page-wrapper">
      <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const users = queue?.users || []
  const serving = users.find(u => u.status === 'serving')
  const waitingCount = users.filter(u => u.status === 'waiting').length

  return (
    <div className="container max-w-7xl pt-8 pb-20">

      {/* Control Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 pb-6 border-b border-white/5">
        <div className="flex flex-col">
          <button onClick={() => navigate('/')} className="text-zinc-500 hover:text-white mb-6 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors w-fit">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            Dashboard
          </button>
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-white/5 flex items-center justify-center text-3xl shadow-sm">
              {business?.name?.[0]}
            </div>
            <div>
              <h1 className="text-3xl font-black text-white mb-1 tracking-tight leading-none">{business?.name}</h1>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-zinc-500 capitalize">
                  {business?.category} Hub
                </span>
                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${business?.isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${business?.isOpen ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {business?.isOpen ? 'Operational' : 'Paused'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`px-5 py-3 rounded-lg font-bold text-xs transition-all w-full sm:w-auto ${
              business?.isOpen 
                ? 'bg-zinc-800 text-zinc-300 hover:bg-rose-500/20 hover:text-rose-400 border border-transparent hover:border-rose-500/30' 
                : 'bg-teal-500 hover:bg-teal-600 text-white shadow-md'
            }`}
          >
            {toggling ? 'Updating...' : business?.isOpen ? 'Pause Operations' : 'Resume Operations'}
          </button>
          <button
            onClick={handleCallNext}
            disabled={calling || users.length === 0}
            className="px-6 py-3 rounded-lg bg-teal-500 text-white font-bold text-xs shadow-md hover:bg-teal-600 active:scale-95 disabled:opacity-50 transition-all w-full sm:w-auto flex items-center justify-center gap-2"
          >
            {calling ? 'Processing...' : 'Serve Next in Queue'}
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Main Grid: Statistics & Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: Live Statistics */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-zinc-900 border border-white/5 p-6 rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Live Traffic</p>
              <div className="flex items-end gap-3">
                <p className="text-5xl font-black text-white leading-none">{users.length}</p>
                <p className="text-[10px] font-bold text-teal-500 mb-1 uppercase tracking-wider">Waiting In Hub</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
               <div className="bg-zinc-900 border border-white/5 p-5 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Service Duration</p>
                <p className="text-xl font-bold text-white uppercase">{business?.averageServiceTime} <span className="text-[10px] font-medium text-zinc-500">Mins</span></p>
              </div>
              <div className="bg-zinc-900 border border-white/5 p-5 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Peak Hours</p>
                <p className="text-xl font-bold text-white uppercase">14:00 - 15:30</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-white/5 p-6 rounded-2xl">
            <h3 className="text-xs font-bold text-white mb-5 uppercase tracking-widest">Live Insights</h3>
            <div className="space-y-5">
              <div className="group">
                <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-500 mb-2">
                  <span>Capacity</span>
                  <span className="text-white">78%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '78%' }} className="h-full bg-teal-500 transition-all duration-1000" />
                </div>
              </div>
              <div className="group">
                <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-500 mb-2">
                  <span>Avg Delay Impact</span>
                  <span className="text-emerald-500">-2 min</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '20%' }} className="h-full bg-emerald-500 transition-all duration-1000" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Serving Status & Queue Feed */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          
          {/* Active Unit */}
          <motion.div layout className="bg-zinc-900 border border-teal-500/30 p-8 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center border ${serving ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>
                  {serving ? <span className="text-2xl">⚡</span> : <span className="text-2xl">💤</span>}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-teal-500 uppercase tracking-widest mb-1 border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 rounded-sm w-fit">Active Session</p>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {serving ? `${serving.userId?.name || 'Customer'} - ${serving.serviceType}` : 'Ready to accept next customer'}
                  </h2>
                </div>
              </div>
              
              {serving && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Est. End Time</p>
                    <p className="text-lg font-bold text-white tabular-nums">{new Date(new Date(serving.estimatedStartTime).getTime() + serving.serviceTime * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleExtend(serving.userId?._id || serving.userId, 5)}
                      className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-colors border border-white/5"
                    >
                      +5m Time
                    </button>
                    <button 
                      onClick={handleCallNext}
                      className="px-5 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Table Feed */}
          <div className="bg-zinc-900 rounded-2xl border border-white/5 shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">Live Queue Roster</h3>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                <span className="text-[10px] font-bold text-teal-500 uppercase tracking-widest">Synced</span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950/50">
                    <th className="py-3 px-6 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">#</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Identity</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Service</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Duration</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence initial={false}>
                    {users.map((u, i) => (
                      <motion.tr 
                        key={u.userId?._id?.toString() || u.userId?.toString() || i}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className={`group hover:bg-zinc-800/50 transition-colors ${u.status === 'serving' ? 'bg-teal-500/5' : ''}`}
                      >
                        <td className="py-4 px-6 font-bold text-zinc-500 text-sm group-hover:text-teal-400 transition-colors">{i + 1}</td>
                        <td className="py-4 px-4">
                          <p className="font-bold text-zinc-200 text-sm">{u.userId?.name || 'Customer'}</p>
                          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{u.userId?._id?.toString()?.slice(-6) || u.userId?.toString()?.slice(-6)}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-xs font-medium text-zinc-300">
                            {u.serviceType}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-xs font-bold text-zinc-300">{u.serviceTime} min</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded inline-flex items-center gap-1.5 uppercase tracking-wider ${
                            u.status === 'serving' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-transparent text-zinc-500 border border-zinc-700'
                          }`}>
                            {u.status === 'serving' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                            {u.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              
              {users.length === 0 && (
                <div className="py-24 text-center">
                  <p className="text-3xl opacity-30 mb-3 text-zinc-500">📋</p>
                  <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">No Active Queue</h4>
                  <p className="text-xs text-zinc-600 mt-1 font-medium">Awaiting check-ins...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
