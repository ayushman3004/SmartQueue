import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getQueue, leaveQueue, cancelDelay } from '../api/queue.api'
import { getBusiness } from '../api/business.api'
import QueueCard from '../components/QueueCard'
import { toast } from 'react-hot-toast'

export default function QueuePage() {
  const { businessId } = useParams()
  const { user } = useAuth()
  const { joinRoom, joinUser, leaveRoom, onQueueUpdate, onQueueDelay, onBusinessStatus, connected } = useSocket()
  const navigate = useNavigate()

  const [business, setBusiness] = useState(null)
  const [queue, setQueue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [timer, setTimer] = useState('')
  const [delayInfo, setDelayInfo] = useState(null)

  const prevInQueue = useRef(false)

  const users = queue?.users || []

  // ✅ SAFE myQueueData
  const myQueueData = user?._id
    ? users.find(
        u => (u.userId?._id || u.userId)?.toString() === user._id.toString()
      )
    : null

  const myPosition = myQueueData ? users.indexOf(myQueueData) + 1 : 0
  const isServing = myQueueData?.status === 'serving'

  // ✅ FETCH DATA
  const fetchData = useCallback(async () => {
    try {
      const [bRes, qRes] = await Promise.all([
        getBusiness(businessId),
        getQueue(businessId).catch(() => ({
          data: { data: { queue: { users: [] } } }
        })),
      ])

      setBusiness(bRes?.data?.data?.business || null)
      setQueue(qRes?.data?.data?.queue || { users: [] })
    } catch {
      toast.error('Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  // ✅ INITIAL DATA FETCH (runs regardless of socket state)
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ✅ SOCKET SETUP (re-fetches when socket connects for freshest data)
  useEffect(() => {
    if (connected) fetchData()

    joinRoom(businessId)
    if (user?._id) joinUser(user._id)

    const unsubUpdate = onQueueUpdate((updatedQueue) => {
      setQueue(updatedQueue || { users: [] })
    })

    const unsubDelay = onQueueDelay((delayData) => {
      setDelayInfo(delayData)
      toast.error(`Queue delayed by ${delayData?.delay || 0} mins`)
    })

    const unsubStatus = onBusinessStatus((statusData) => {
      setBusiness(prev =>
        prev ? { ...prev, isOpen: statusData?.isOpen } : null
      )
    })

    return () => {
      leaveRoom(businessId)
      unsubUpdate?.()
      unsubDelay?.()
      unsubStatus?.()
    }
  }, [businessId, fetchData, connected, user])

  // ✅ TIMER FIX
  useEffect(() => {
    if (!myQueueData?.estimatedStartTime || myQueueData?.status === 'serving') {
      setTimer('')
      return
    }

    const interval = setInterval(() => {
      const start = new Date(myQueueData.estimatedStartTime)
      const now = new Date()
      const diff = start - now

      if (diff <= 0) {
        setTimer('Ready now!')
        clearInterval(interval)
      } else {
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        setTimer(`${mins}m ${secs}s`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [myQueueData])

  // ✅ LEAVE QUEUE
  const handleLeave = async () => {
    if (!window.confirm('Leave queue?')) return

    setActionLoading(true)
    try {
      const res = await leaveQueue(businessId)
      setQueue(res?.data?.data?.queue || { users: [] })
      toast.success('Left queue')
    } catch {
      toast.error('Failed to leave')
    } finally {
      setActionLoading(false)
    }
  }

  // ✅ CANCEL DELAY
  const handleHandleDelay = async () => {
    setActionLoading(true)
    try {
      await cancelDelay(businessId)
      setDelayInfo(null)
      toast.success('Cancelled & refunded')
      navigate('/')
    } catch {
      toast.error('Failed')
    } finally {
      setActionLoading(false)
    }
  }

  // ✅ LOADING UI
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="w-10 h-10 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="container py-12 px-4 sm:px-6">

      {/* DELAY ALERT */}
      <AnimatePresence>
        {delayInfo && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8 p-6 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shadow-xs border border-amber-100">⚠️</div>
              <div>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-0.5">Queue Delay Detected</p>
                <p className="text-xs font-bold text-amber-600">Service delayed by {delayInfo?.delay || 0} minutes. You may cancel for a full refund.</p>
              </div>
            </div>
            <button
              onClick={handleHandleDelay}
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all active:scale-95 shadow-xs whitespace-nowrap"
            >
              {actionLoading ? 'Processing...' : 'Cancel & Refund'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

        {/* LEFT COLUMN — Your Status */}
        <div className="lg:col-span-4 space-y-8">

          {myQueueData ? (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white border border-zinc-200 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-[40px] pointer-events-none" />

              {isServing ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl shadow-xs border border-emerald-200">⚡</div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 mb-0.5">Now Serving</p>
                      <h2 className="text-2xl font-black text-zinc-950 tracking-tight leading-none">Your Turn</h2>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 text-center shadow-xs mb-6">
                    <p className="text-4xl font-black text-emerald-700 leading-none mb-2">🎯</p>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Proceed to Counter</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white text-xl font-black shadow-md shadow-teal-600/20">
                      #{myPosition}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-600 mb-0.5">Queue Position</p>
                      <h2 className="text-2xl font-black text-zinc-950 tracking-tight leading-none">In Line</h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-zinc-100 text-center shadow-xs">
                      <p className="text-lg font-black text-teal-700 leading-none mb-1.5 tabular-nums">{timer || '--'}</p>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">ETA</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-zinc-100 text-center shadow-xs">
                      <p className="text-lg font-black text-zinc-950 leading-none mb-1.5 capitalize">{myQueueData?.status}</p>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Status</p>
                    </div>
                  </div>

                  {myQueueData?.serviceType && (
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-100 mb-6 shadow-xs">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-teal-600 mb-1">Service</p>
                      <p className="text-sm font-black text-teal-700">{myQueueData.serviceType}</p>
                    </div>
                  )}
                </>
              )}

              <button
                onClick={handleLeave}
                disabled={actionLoading}
                className="w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all active:scale-95 shadow-xs"
              >
                {actionLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : 'Leave Queue'}
              </button>
            </motion.div>

          ) : (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white border border-zinc-200 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full blur-[40px] pointer-events-none" />
              <div className="text-center py-8">
                <p className="text-5xl mb-6 opacity-20">🚶</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Not In Queue</p>
                <p className="text-xs font-bold text-slate-300 uppercase mb-8">You haven't joined this queue yet.</p>
                <button
                  onClick={() => navigate('/')}
                  className="px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-zinc-950 text-white hover:bg-zinc-800 transition-all active:scale-95 shadow-lg"
                >
                  Return to Dashboard
                </button>
              </div>
            </motion.div>
          )}

        </div>

        {/* RIGHT COLUMN — Queue Feed */}
        <div className="lg:col-span-8">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-zinc-200 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 relative z-10">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 uppercase tracking-tighter leading-none mb-1.5">
                  {business?.name ? (
                    <>
                      {business.name.split(' ')[0]}<span className="text-teal-600">{business.name.split(' ').length > 1 ? ` ${business.name.split(' ').slice(1).join(' ')}` : ''}</span>
                    </>
                  ) : 'Business'}
                </h1>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  {business?.category || 'General'} Hub • Live Queue Feed
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-slate-50 border border-zinc-100 px-6 py-4 rounded-2xl flex flex-col min-w-[100px] shadow-xs text-center">
                  <span className="text-2xl font-black text-zinc-950 leading-none">{users.length}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">In Queue</span>
                </div>
                {business?.isOpen !== undefined && (
                  <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${
                    business.isOpen 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${business.isOpen ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'}`} />
                    {business.isOpen ? 'Live' : 'Closed'}
                  </div>
                )}
              </div>
            </div>

            {/* Queue List */}
            <div className="space-y-3 relative z-10">
              {users.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-zinc-200">
                  <p className="text-5xl mb-6 opacity-20">🏜️</p>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Queue Empty</p>
                  <p className="text-[10px] mt-2 font-bold text-slate-300 uppercase">No users currently in queue.</p>
                </div>
              ) : (
                <AnimatePresence>
                  {users.map((u, i) => (
                    <QueueCard
                      key={(u.userId?._id || u.userId)?.toString() || i}
                      user={u}
                      position={i + 1}
                      isMe={
                        (u.userId?._id || u.userId)?.toString() === user?._id?.toString()
                      }
                      totalUsers={users.length}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer Legend */}
            {users.length > 0 && (
              <div className="mt-10 pt-10 border-t border-zinc-100 flex flex-wrap items-center gap-8 justify-center sm:justify-start text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-lg bg-teal-50 border border-teal-200" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Your Position</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-lg bg-emerald-50 border border-emerald-200" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Being Served</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-lg bg-white border border-zinc-200" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Waiting</span>
                </div>
              </div>
            )}
          </motion.div>

        </div>
      </div>
    </div>
  )
}