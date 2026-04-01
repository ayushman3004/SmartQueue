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
      toast.error(msg, { style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #fef2f2' } })
    } else {
      toast.success(msg, { style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #f4f4f5' } })
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
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] page-wrapper bg-slate-50">
      <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const users = queue?.users || []
  const serving = users.find(u => u.status === 'serving')
  const waitingCount = users.filter(u => u.status === 'waiting').length

  return (
    <div className="container max-w-7xl pt-8 pb-20">

      {/* Control Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 pb-6 border-b border-zinc-200">
        <div className="flex flex-col">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-zinc-950 mb-6 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors w-fit border border-transparent hover:border-zinc-200 px-3 py-1.5 rounded-lg hover:bg-white transition-all">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Dashboard
          </button>
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-3xl font-black text-teal-700 shadow-sm transition-transform hover:scale-105">
              {business?.name?.[0]}
            </div>
            <div>
              <h1 className="text-3xl font-black text-zinc-950 mb-2 tracking-tight leading-none">{business?.name}</h1>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {business?.category} Unit Ops
                </span>
                <span className="w-1 h-1 rounded-full bg-zinc-200" />
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${business?.isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${business?.isOpen ? 'text-emerald-700' : 'text-rose-700'}`}>
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
            disabled={toggling || !business?.isActive}
            className={`px-6 py-3 rounded-xl font-bold text-xs transition-all w-full sm:w-auto border shadow-xs ${
              !business?.isActive
                ? 'bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed opacity-60'
                : business?.isOpen 
                  ? 'bg-white border-zinc-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100' 
                  : 'bg-teal-600 border-teal-500 hover:bg-teal-700 text-white shadow-teal-600/10 shadow-lg'
            }`}
          >
            {toggling ? 'Updating...' : !business?.isActive ? 'SUSPENDED BY ADMIN' : business?.isOpen ? 'Deactivate Hub' : 'Activate Hub'}
          </button>
          <button
            onClick={handleCallNext}
            disabled={calling || users.length === 0}
            className="px-8 py-3 rounded-xl bg-teal-600 border border-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-600/10 hover:bg-teal-700 active:scale-95 disabled:opacity-50 transition-all w-full sm:w-auto flex items-center justify-center gap-2"
          >
            {calling ? 'Processing...' : 'Serve Next Pool Entry'}
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Main Grid: Statistics & Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: Live Statistics */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-md">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Unit Traffic</p>
              <div className="flex items-end gap-3">
                <p className="text-5xl font-black text-zinc-950 leading-none">{users.length}</p>
                <p className="text-[10px] font-bold text-teal-700 mb-1 uppercase tracking-wider">Entries In Pool</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
               <div className="bg-white border border-zinc-200 p-5 rounded-xl shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-left">Target Duration</p>
                <p className="text-xl font-bold text-zinc-950 uppercase text-left">{business?.averageServiceTime} <span className="text-[10px] font-medium text-slate-400">Mins</span></p>
              </div>
              <div className="bg-white border border-zinc-200 p-5 rounded-xl shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-left">Deployment Window</p>
                <p className="text-xl font-bold text-zinc-950 uppercase text-left">24/7 Live</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
            <h3 className="text-xs font-bold text-zinc-950 mb-5 uppercase tracking-widest">Real-time Insights</h3>
            <div className="space-y-6">
              <div className="group">
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-2">
                  <span>Unit Load</span>
                  <span className="text-zinc-950">{(Math.random() * 20 + 70).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '78%' }} className="h-full bg-teal-600 transition-all duration-1000" />
                </div>
              </div>
              <div className="group">
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-2">
                  <span>Wait Efficiency</span>
                  <span className="text-emerald-700">+8.4%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '45%' }} className="h-full bg-emerald-600 transition-all duration-1000" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Serving Status & Queue Feed */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          
          {/* Active Unit */}
          <motion.div layout className="bg-white border border-teal-200 p-8 rounded-2xl shadow-lg relative overflow-hidden bg-teal-50/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-600/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-transform shadow-xs ${serving ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-zinc-100 text-slate-500'}`}>
                  {serving ? <span className="text-2xl animate-pulse">⚡</span> : <span className="text-2xl">💤</span>}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-teal-700 uppercase tracking-widest mb-1.5 border border-teal-200 bg-teal-100 px-2.5 py-1 rounded-lg w-fit">Active Session</p>
                  <h2 className="text-2xl font-black text-zinc-950 tracking-tight leading-none">
                    {serving ? `${serving.userId?.name || 'Authorized User'} - ${serving.serviceType}` : 'Awaiting manual pool assignment'}
                  </h2>
                </div>
              </div>
              
              {serving && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Est. Terminal Time</p>
                    <p className="text-xl font-bold text-zinc-950 tabular-nums">{new Date(new Date(serving.estimatedStartTime).getTime() + serving.serviceTime * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleExtend(serving.userId?._id || serving.userId, 5)}
                      className="px-4 py-3 rounded-xl bg-white border border-zinc-200 hover:bg-slate-50 text-slate-500 font-bold text-xs transition-colors shadow-xs"
                    >
                      +5m Shift
                    </button>
                    <button 
                      onClick={handleCallNext}
                      className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-lg shadow-teal-600/10 active:scale-95 transition-all"
                    >
                      Cycle Hub
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Table Feed */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden min-h-[400px]">
            <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-xs font-black text-zinc-950 uppercase tracking-[0.2em]">Operational Queue Roster</h3>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-100 border border-teal-200">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">LIVE FEED</span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/50">
                    <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-zinc-100">#</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-zinc-100">Identity Header</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-zinc-100">Unit Type</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-zinc-100">Block</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-zinc-100 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  <AnimatePresence initial={false}>
                    {users.map((u, i) => (
                      <motion.tr 
                        key={u.userId?._id?.toString() || u.userId?.toString() || i}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className={`group transition-all ${u.status === 'serving' ? 'bg-teal-50/50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="py-5 px-8 font-bold text-slate-300 text-xs group-hover:text-teal-600 transition-colors">{(i + 1).toString().padStart(2, '0')}</td>
                        <td className="py-5 px-4">
                          <p className="font-bold text-zinc-950 text-sm leading-none mb-1.5">{u.userId?.name || 'Anonymous Node'}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest tabular-nums">ID-{u.userId?._id?.toString()?.slice(-6) || 'HIDDEN'}</p>
                        </td>
                        <td className="py-5 px-4">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {u.serviceType}
                          </span>
                        </td>
                        <td className="py-5 px-4">
                          <p className="text-xs font-black text-zinc-950">{u.serviceTime}min</p>
                        </td>
                        <td className="py-5 px-4 text-right">
                          <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg inline-flex items-center gap-2 uppercase tracking-widest border ${
                            u.status === 'serving' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-zinc-200'
                          }`}>
                            {u.status === 'serving' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                            {u.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              
              {users.length === 0 && (
                <div className="py-32 text-center">
                  <p className="text-5xl opacity-20 mb-6">🏜️</p>
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-[0.3em]">Operational Vacuum</h4>
                  <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Awaiting system input nodes...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
