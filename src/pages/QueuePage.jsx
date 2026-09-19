import { useEffect, useState, useCallback } from 'react'
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">

        {/* LEFT COLUMN — Your Status */}
        <div className="lg:col-span-4 space-y-6">

          {myQueueData ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="bezel-shell"
            >
              <div className="bezel-core p-6 sm:p-7 relative overflow-hidden">
                {isServing ? (
                  <>
                    <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-zinc-100">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-300 flex items-center justify-center text-2xl shadow-xs">⚡</div>
                      <div>
                        <span className="badge-eyebrow bg-emerald-50 text-emerald-700 border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-radar" />
                          Ready For You
                        </span>
                        <h2 className="text-2xl font-black text-zinc-950 tracking-tight leading-none mt-1">Your Turn!</h2>
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-center shadow-xs mb-6">
                      <p className="text-3xl font-black text-emerald-700 leading-none mb-1.5">🎯</p>
                      <p className="text-xs font-black text-emerald-700 uppercase tracking-wider">Please proceed to service desk</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-zinc-100">
                      <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center text-lg font-black shadow-md shadow-teal-600/20">
                        #{myPosition}
                      </div>
                      <div>
                        <span className="badge-eyebrow">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                          Live Ticket
                        </span>
                        <h2 className="text-2xl font-black text-zinc-950 tracking-tight leading-none mt-1">In Queue</h2>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-center shadow-xs">
                        <p className="text-xl font-black text-teal-700 leading-none mb-1 tabular-nums">{timer || '--'}</p>
                        <p className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-400">Estimated Turn</p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-center shadow-xs">
                        <p className="text-xl font-black text-zinc-950 leading-none mb-1 capitalize">{myQueueData?.status}</p>
                        <p className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-400">Status</p>
                      </div>
                    </div>

                    {myQueueData?.serviceType && (
                      <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/70 mb-5 text-left">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-teal-600 mb-0.5">Selected Service</p>
                        <p className="text-xs font-black text-teal-900">{myQueueData.serviceType}</p>
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={handleLeave}
                  disabled={actionLoading}
                  className="w-full py-3.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-white border border-rose-200 text-rose-600 hover:bg-rose-50/80 hover:border-rose-300 transition-all active:scale-[0.97] shadow-xs"
                >
                  {actionLoading ? 'Processing...' : 'Leave Queue & Step Out'}
                </button>
              </div>
            </motion.div>

          ) : (
            <div className="bezel-shell">
              <div className="bezel-core p-8 text-center space-y-3">
                <p className="text-4xl">🚶</p>
                <h3 className="text-base font-black text-zinc-800">You are not in line</h3>
                <p className="text-xs text-zinc-400 font-medium">Join this queue from the hub dashboard to receive live updates.</p>
                <button
                  onClick={() => navigate('/')}
                  className="btn-island py-3 px-5 text-xs mt-2"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN — Queue Feed */}
        <div className="lg:col-span-8">
          <div className="bezel-shell">
            <div className="bezel-core p-6 sm:p-8 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-zinc-100">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight leading-none mb-1">
                    {business?.name || 'Business'}
                  </h1>
                  <p className="text-xs font-semibold text-zinc-500 capitalize">
                    {business?.category || 'General'} Hub &bull; Live Synchronous Stream
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="bg-zinc-50 border border-zinc-200/80 px-4 py-2 rounded-2xl flex items-baseline gap-1.5 shadow-xs">
                    <span className="text-xl font-black text-zinc-950">{users.length}</span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Waiting</span>
                  </div>
                  {business?.isOpen !== undefined && (
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-[10px] font-black uppercase tracking-wider ${
                      business.isOpen 
                        ? 'bg-emerald-50 border-emerald-200/80 text-emerald-700' 
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${business.isOpen ? 'bg-emerald-500 animate-radar' : 'bg-rose-500'}`} />
                      {business.isOpen ? 'Open' : 'Closed'}
                    </div>
                  )}
                </div>
              </div>

              {/* Queue List */}
              <div className="space-y-2.5">
                {users.length === 0 ? (
                  <div className="text-center py-16 bg-zinc-50/60 rounded-2xl border border-dashed border-zinc-200">
                    <p className="text-4xl mb-3">✨</p>
                    <p className="text-xs font-black text-zinc-700 uppercase tracking-wider">Queue Is Currently Clear</p>
                    <p className="text-[11px] text-zinc-400 mt-1">Immediate service available upon check-in.</p>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}