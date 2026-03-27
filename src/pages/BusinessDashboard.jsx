import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getQueue, callNext, extendUserTime } from '../api/queue.api'
import { getBusiness, toggleBusiness } from '../api/business.api'
import {
  getBusinessBookings,
  extendBooking,
  startBookingService,
  completeBookingService,
} from '../api/booking.api'

export default function BusinessDashboard() {
  const { businessId } = useParams()
  const { user } = useAuth()
  const { joinRoom, leaveRoom, onQueueUpdate, socket } = useSocket()
  const navigate = useNavigate()

  const [business, setBusiness] = useState(null)
  const [queue, setQueue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [calling, setCalling] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [toast, setToast] = useState(null)

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

    joinRoom(businessId)
    const unsub = onQueueUpdate(setQueue)
    return () => { leaveRoom(businessId); unsub?.() }
  }, [businessId, user, navigate, joinRoom, leaveRoom, onQueueUpdate])

  const showToast = (msg, type = 'info') => {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleCallNext = async () => {
    if (queue?.users?.length === 0) return
    setCalling(true)
    try {
      const res = await callNext(businessId)
      setQueue(res.data.data.queue)
      showToast('⏭ Successfully called next customer', 'success')
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
      <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const users = queue?.users || []
  const serving = users.find(u => u.status === 'serving')
  const waitingCount = users.filter(u => u.status === 'waiting').length

  return (
    <div className="container py-8 max-w-7xl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 left-1/2 z-[100] px-6 py-4 rounded-2xl shadow-2xl glass-bright border-white/20"
            style={{ 
              backgroundColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(6, 182, 212, 0.95)',
              color: 'white'
             }}
          >
            <div className="flex items-center gap-3 font-bold">
              {toast.type === 'error' ? '🚫' : '✅'}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
        <div className="relative">
          <button onClick={() => navigate('/')} className="text-neutral-500 hover:text-white mb-4 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            Back to Dashboard
          </button>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-4xl shadow-2xl shadow-cyan-500/20">
              {business?.name?.[0]}
            </div>
            <div>
              <h1 className="text-4xl font-black text-white mb-2 leading-none uppercase tracking-tighter">{business?.name}</h1>
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/5 text-neutral-400 border border-white/10 uppercase tracking-widest leading-none">
                  {business?.category} Hub
                </span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${business?.isOpen ? 'bg-cyan-500 pulse-dot' : 'bg-red-500'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${business?.isOpen ? 'text-cyan-500' : 'text-red-500'}`}>
                    {business?.isOpen ? 'Operational' : 'Paused'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 p-2 bg-neutral-900/50 rounded-2xl border border-white/5">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`px-6 py-4 rounded-xl font-black text-xs uppercase tracking-[0.1em] transition-all ${
              business?.isOpen 
                ? 'bg-neutral-800 text-neutral-400 hover:bg-red-500/20 hover:text-red-400' 
                : 'bg-linear-to-r from-cyan-500 to-blue-600 text-black'
            }`}
          >
            {toggling ? '...' : business?.isOpen ? '🟥 Close Shop' : '🟩 Open Shop'}
          </button>
          <button
            onClick={handleCallNext}
            disabled={calling || users.length === 0}
            className="px-8 py-4 rounded-xl bg-white text-black font-black text-xs uppercase tracking-[0.1em] shadow-xl hover:scale-105 active:scale-95 disabled:opacity-20 transition-all"
          >
            {calling ? 'Processing...' : '⏭ Serve Next'}
          </button>
        </div>
      </div>

      {/* Main Grid: Statistics & Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: Live Statistics */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="glass-bright p-6 border-cyan-500/20">
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-4">Live Traffic</p>
              <div className="flex items-end gap-3">
                <p className="text-6xl font-black text-white">{users.length}</p>
                <p className="text-xs font-bold text-cyan-500 mb-2 uppercase">Waiting In Hub</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
               <div className="glass p-5 border-white/5">
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">Wait Duration</p>
                <p className="text-2xl font-black text-white uppercase">{business?.averageServiceTime} <span className="text-xs font-medium text-neutral-500">Minutes</span></p>
              </div>
              <div className="glass p-5 border-white/5">
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">Daily Peak</p>
                <p className="text-2xl font-black text-white uppercase">14:00 - 15:30</p>
              </div>
            </div>
          </div>

          <div className="glass p-8 bg-linear-to-br from-neutral-900 to-black">
            <h3 className="text-sm font-black text-white mb-6 uppercase tracking-[0.2em]">Live Insights</h3>
            <div className="space-y-6">
              <div className="group">
                <div className="flex justify-between text-[10px] font-black uppercase text-neutral-500 mb-2">
                  <span>Capacity Utilization</span>
                  <span>78%</span>
                </div>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '78%' }} className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                </div>
              </div>
              <div className="group">
                <div className="flex justify-between text-[10px] font-black uppercase text-neutral-500 mb-2">
                  <span>Avg Delay Impact</span>
                  <span>-2 min</span>
                </div>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '20%' }} className="h-full bg-green-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Serving Status & Queue Feed */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          
          {/* Active Unit */}
          <motion.div layout className="glass-bright p-8 bg-linear-to-br from-cyan-500/10 via-transparent to-transparent border-cyan-500/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center border-2 border-cyan-500/50">
                  {serving ? <span className="text-3xl animate-pulse">⚡</span> : <span className="text-2xl">💤</span>}
                </div>
                <div>
                  <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-1">Serving Now</p>
                  <h2 className="text-2xl font-black text-white uppercase">
                    {serving ? `Customer #${users.indexOf(serving) + 1} - ${serving.serviceType}` : 'Ready for next customer'}
                  </h2>
                </div>
              </div>
              {serving && (
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Est. End Time</p>
                    <p className="text-xl font-bold text-white uppercase">{new Date(new Date(serving.estimatedStartTime).getTime() + serving.serviceTime * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleExtend(serving.userId?._id || serving.userId, 5)}
                      className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-neutral-400 font-black text-xs uppercase hover:bg-white/10 transition-all"
                    >
                      +5m EXTEND
                    </button>
                    <button 
                      onClick={handleCallNext}
                      className="px-6 py-3 rounded-xl bg-cyan-500 text-black font-black text-xs uppercase shadow-xl hover:scale-105 active:scale-95 transition-all"
                    >
                      Finish & Call Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Table Feed */}
          <div className="glass overflow-hidden">
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Queue Waitlist</h3>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500 pulse-dot" />
                <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Real-time Feed</span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/2">
                    <th className="py-4 px-8 text-left text-[10px] font-black text-neutral-500 uppercase tracking-widest">Pos</th>
                    <th className="py-4 px-4 text-left text-[10px] font-black text-neutral-500 uppercase tracking-widest">Customer ID</th>
                    <th className="py-4 px-4 text-left text-[10px] font-black text-neutral-500 uppercase tracking-widest">Service Item</th>
                    <th className="py-4 px-4 text-left text-[10px] font-black text-neutral-500 uppercase tracking-widest">Wait Time</th>
                    <th className="py-4 px-4 text-left text-[10px] font-black text-neutral-500 uppercase tracking-widest">Status</th>
                    <th className="py-4 px-8 text-right text-[10px] font-black text-neutral-500 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence initial={false}>
                    {users.map((u, i) => (
                      <motion.tr 
                        key={u.userId?._id?.toString() || u.userId?.toString() || i}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, x: -100 }}
                        className={`group hover:bg-white/5 transition-colors ${u.status === 'serving' ? 'bg-cyan-500/5' : ''}`}
                      >
                        <td className="py-6 px-8 font-black text-neutral-600 text-sm group-hover:text-cyan-500 transition-colors">#{i + 1}</td>
                        <td className="py-6 px-4">
                          <p className="font-bold text-white text-sm">Customer {i + 1}</p>
                          <p className="text-[10px] text-neutral-500 uppercase font-medium">{u.userId?._id?.toString()?.slice(-6) || u.userId?.toString()?.slice(-6)}</p>
                        </td>
                        <td className="py-6 px-4">
                          <span className="text-xs font-bold text-white bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 group-hover:border-cyan-500/20 uppercase transition-all">
                            {u.serviceType}
                          </span>
                        </td>
                        <td className="py-6 px-4">
                          <p className="text-xs font-bold text-white">{u.serviceTime} Min</p>
                          <p className="text-[10px] text-neutral-500 uppercase">Per Service</p>
                        </td>
                        <td className="py-6 px-4">
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-md uppercase tracking-widest ${
                            u.status === 'serving' ? 'bg-linear-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400' : 'bg-neutral-800 text-neutral-500'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="py-6 px-8 text-right">
                          {u.status === 'waiting' ? (
                            <button className="text-[10px] font-black text-neutral-500 hover:text-white uppercase transition-colors">
                              Prioritize
                            </button>
                          ) : (
                            <div className="flex justify-end items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                              <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">In Progress</span>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              
              {users.length === 0 && (
                <div className="py-24 text-center">
                  <p className="text-5xl opacity-20 mb-4">🎑</p>
                  <h4 className="text-lg font-black text-neutral-700 uppercase tracking-widest">No Active Queue</h4>
                  <p className="text-xs text-neutral-600 mt-2 font-medium">Waiting for customer check-ins...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
