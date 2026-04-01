import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getQueue, leaveQueue, getWaitEstimate, cancelDelay } from '../api/queue.api'
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
  const [error, setError] = useState('')
  const [timer, setTimer] = useState('')

  const [delayInfo, setDelayInfo] = useState(null)
  const [compensationCoupon, setCompensationCoupon] = useState(null)

  const [estimating, setEstimating] = useState(false)
  const [estimation, setEstimation] = useState(null)
  const estimationCacheRef = useRef({ data: null, timestamp: 0 })
  const CACHE_DURATION = 15000 

  const [showFeedback, setShowFeedback] = useState(false)
  const [rating, setRating] = useState(5)
  const prevInQueue = useRef(false)

  const users = queue?.users || []
  const myQueueData = users.find(u => (u.userId?._id || u.userId)?.toString() === user?._id?.toString())
  const myPosition = users.indexOf(myQueueData) + 1
  const isServing = myQueueData?.status === 'serving'

  const fetchData = useCallback(async () => {
    try {
      const [bRes, qRes] = await Promise.all([
        getBusiness(businessId),
        getQueue(businessId).catch(() => ({ data: { data: { queue: { users: [] } } } })),
      ])
      setBusiness(bRes.data.data.business)
      setQueue(qRes.data.data.queue)
    } catch {
      setError('Failed to load queue data')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    if (connected) {
      fetchData()
    }
    joinRoom(businessId)
    if (user?._id) joinUser(user._id)
    
    const unsubUpdate = onQueueUpdate((updatedQueue) => {
      setQueue(updatedQueue)
      estimationCacheRef.current = { data: null, timestamp: 0 }
      setEstimation(null)
    })

    const unsubDelay = onQueueDelay((delayData) => {
      setDelayInfo(delayData)
      toast.dismiss('queue-delay')
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-neutral-900 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden pointer-events-auto`}>
          <div className="bg-linear-to-r from-rose-500/20 to-transparent p-6 pb-2 border-b border-white/5">
            <p className="text-xs font-black text-rose-400 uppercase tracking-widest mb-1">Queue Delay</p>
            <p className="text-xl font-black text-white">Wait extended by {delayData.delay}m</p>
          </div>
          <div className="p-6">
            <p className="text-xs text-neutral-400 mb-6">Receive ₹{delayData.compensation} in your wallet as compensation?</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => { toast.dismiss(t.id); }}
                className="w-full py-3 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                Continue Waiting
              </button>
              <button 
                onClick={() => { handleHandleDelay('cancel'); toast.dismiss(t.id); }}
                className="w-full py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                Cancel & Get Refund
              </button>
            </div>
          </div>
        </div>
      ), { id: 'queue-delay', duration: 15000, position: 'top-center' })
    })

    const unsubStatus = onBusinessStatus((statusData) => {
      setBusiness(prev => prev ? ({ ...prev, isOpen: statusData.isOpen }) : null)
      if (statusData.isOpen) toast.success(statusData.message, { icon: '🔓' })
      else toast.error(statusData.message, { icon: '🔒', duration: 6000 })
    })

    return () => {
      leaveRoom(businessId)
      unsubUpdate?.()
      unsubDelay?.()
      unsubStatus?.()
    }
  }, [businessId, fetchData, connected])

  useEffect(() => {
    if (loading) return
    const me = users.find(u => (u.userId?._id || u.userId)?.toString() === user?._id?.toString())
    if (prevInQueue.current && !me && !compensationCoupon) setShowFeedback(true)
    prevInQueue.current = !!me
  }, [users, user, loading])

  useEffect(() => {
    if (!myQueueData?.estimatedStartTime || myQueueData.status === 'serving') {
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

  const handleLeave = async () => {
    if (!window.confirm('Leave the queue?')) return
    setActionLoading(true)
    try {
      const res = await leaveQueue(businessId)
      setQueue(res.data.data.queue)
      toast.success('Left the queue.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleHandleDelay = async (action) => {
    if (action === 'cancel') {
        setActionLoading(true)
        try {
            await cancelDelay(businessId)
            setDelayInfo(null)
            toast.success('Cancelled. Refund added to wallet!')
            navigate('/')
        } catch (err) {
            toast.error('Failed to process')
        } finally {
            setActionLoading(false)
        }
    } else {
        setDelayInfo(null)
    }
  }

  const handleEstimate = async () => {
    const now = Date.now()
    if (estimationCacheRef.current.data && now - estimationCacheRef.current.timestamp < CACHE_DURATION) {
      setEstimation(estimationCacheRef.current.data)
      return
    }
    setEstimating(true)
    try {
      const res = await getWaitEstimate(businessId)
      setEstimation(res.data.data.estimation)
      estimationCacheRef.current = { data: res.data.data.estimation, timestamp: Date.now() }
    } catch (err) {
      toast.error('Failed to get estimate')
    } finally {
      setEstimating(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const progressPercent = myPosition > 0 ? Math.max(0, 100 - (myPosition * 10)) : 100

  // Removed full-screen block to allow live exploring for unqueued consumers

  return (
    <div className="container lg:max-w-7xl relative pb-20 pt-8">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-cyan-500/5 blur-[120px] pointer-events-none -z-10" />

      {/* Feedback Modal Overlay */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} className="glass-bright p-8 md:p-12 max-w-md w-full text-center border-white/20 rounded-[3rem]">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-8 border-4 border-emerald-500 shadow-xl shadow-emerald-500/20">
                <span className="text-4xl">✅</span>
              </div>
              <h2 className="text-4xl font-black text-white mb-3 uppercase tracking-tighter italic">Finished!</h2>
              <p className="text-neutral-400 mb-10">We hope you had a great experience!</p>
              <button onClick={() => navigate('/')} className="w-full py-6 rounded-[2rem] bg-linear-to-r from-emerald-500 to-teal-600 text-black font-black uppercase tracking-widest text-xs shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all">
                Return to Home
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 xl:col-span-4 space-y-8">
          {myQueueData ? (
            <motion.div layout className="glass-bright p-8 md:p-12 relative overflow-hidden flex flex-col items-center text-center shadow-2xl border-white/10 rounded-[3rem]">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-neutral-900/50">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} className="h-full bg-linear-to-r from-cyan-500 via-blue-500 to-indigo-600 shadow-[0_0_15px_currentColor]" />
              </div>

              {isServing ? (
                <div className="py-8">
                  <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [1, 1.1, 1], opacity: 1 }} transition={{ repeat: Infinity, duration: 2.5 }} className="text-7xl mb-8 drop-shadow-2xl">🎯</motion.div>
                  <h2 className="text-4xl font-black mb-3 text-white uppercase tracking-tighter">Your Turn!</h2>
                  <p className="text-cyan-400 font-black mb-10 uppercase tracking-[0.3em] text-[10px]">Please proceed to service area</p>
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex justify-between items-center mb-10">
                    <span className="text-[10px] font-black tracking-[0.3em] text-neutral-500 uppercase">My Tracker</span>
                    <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/20 bg-amber-500/10 text-amber-500">
                      {myQueueData.status}
                    </span>
                  </div>

                  <div className="relative mb-10 py-6">
                    <p className="text-9xl font-black text-white leading-none tracking-tighter italic">#{myPosition}</p>
                    <p className="text-xs font-black text-neutral-500 mt-6 uppercase tracking-[0.4em]">Current Position</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5">
                      <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-2 text-left">ETA</p>
                      <p className="text-2xl font-black text-white tracking-tighter text-left">{timer || '--:--'}</p>
                    </div>
                    <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5">
                      <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-2 text-left">Time Slot</p>
                      <p className="text-lg font-black text-white text-left uppercase">
                        {myQueueData.estimatedStartTime ? new Date(myQueueData.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ASAP'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button onClick={handleLeave} className="mt-8 text-[10px] text-neutral-600 hover:text-rose-500 font-black uppercase tracking-[0.3em] transition-all">
                Cancel My Entry
              </button>
            </motion.div>
          ) : (
            <motion.div layout className="glass-bright p-8 md:p-12 relative overflow-hidden flex flex-col items-center text-center shadow-2xl border-white/10 rounded-[3rem]">
              <p className="text-7xl mb-6 grayscale opacity-80">👀</p>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-2 uppercase tracking-tighter italic">Observing</h2>
              <p className="text-neutral-500 mb-8 text-xs max-w-[200px] leading-relaxed font-bold">You are viewing this Hub's live feed but are currently not participating.</p>
              <button onClick={() => navigate('/')} className="w-full py-5 rounded-[2rem] glass border-white/10 font-black uppercase tracking-[0.2em] text-[10px] text-white hover:bg-white/5 hover:border-white/20 transition-all active:scale-[0.98]">Return to Dashboard</button>
            </motion.div>
          )}

        </div>

        <div className="lg:col-span-7 xl:col-span-8">
          <div className="glass-bright p-8 md:p-10 rounded-[3.5rem] border-white/5 min-h-[500px]">
            {business && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 pb-10 border-b border-white/5">
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">{business.name}</h1>
                  <p className="text-sm text-neutral-500 mt-1 font-medium">{users.length} hubs active In virtual pool</p>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-left">
                    <p className="text-3xl font-black text-white leading-none mb-1">{users.length}</p>
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">In Live Pool</p>
                  </div>
                  <div className="w-px h-10 bg-white/10" />
                  <div className="text-left">
                    <p className="text-3xl font-black text-cyan-500 leading-none mb-1">{business.averageServiceTime}m</p>
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Avg Session</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {users.length === 0 ? (
                <div className="py-20 text-center glass rounded-[2.5rem] border-dashed border-white/10">
                  <p className="text-sm text-neutral-600 font-black uppercase tracking-widest">The line is clear</p>
                </div>
              ) : (
                users.map((u, i) => (
                  <QueueCard
                    key={`${(u.userId?._id || u.userId)?.toString() || i}`}
                    user={u}
                    position={i + 1}
                    isMe={(u.userId?._id || u.userId)?.toString() === user?._id?.toString()}
                    totalUsers={users.length}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
