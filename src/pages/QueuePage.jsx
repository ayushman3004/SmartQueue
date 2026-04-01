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
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white border border-rose-100 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto`}>
          <div className="bg-rose-50 p-5 pb-3 border-b border-rose-100">
            <p className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-1">Queue Delay</p>
            <p className="text-xl font-bold text-zinc-950">Wait extended by {delayData.delay}m</p>
          </div>
          <div className="p-5">
            <p className="text-sm text-slate-500 mb-5">Receive ₹{delayData.compensation} in your wallet as compensation?</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => { toast.dismiss(t.id); }}
                className="w-full py-3 rounded-lg bg-teal-600 text-white text-xs font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all"
              >
                Continue Waiting
              </button>
              <button 
                onClick={() => { handleHandleDelay('cancel'); toast.dismiss(t.id); }}
                className="w-full py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold uppercase tracking-wider active:scale-95 transition-all"
              >
                Cancel & Get Refund
              </button>
            </div>
          </div>
        </div>
      ), { id: 'queue-delay', duration: 15000, position: 'top-right' })
    })

    const unsubStatus = onBusinessStatus((statusData) => {
      setBusiness(prev => prev ? ({ ...prev, isOpen: statusData.isOpen }) : null)
      if (statusData.isOpen) toast.success(statusData.message, { icon: '🔓', style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #f4f4f5' } })
      else toast.error(statusData.message, { icon: '🔒', duration: 6000, style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #fef2f2' } })
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
    if (!window.confirm('Are you sure you want to leave the queue?')) return
    setActionLoading(true)
    try {
      const res = await leaveQueue(businessId)
      setQueue(res.data.data.queue)
      toast.success('Successfully left the queue.', { style: { borderRadius: '12px', background: '#ffffff', color: '#09090b', border: '1px solid #f4f4f5' } })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave')
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const progressPercent = myPosition > 0 ? Math.max(0, 100 - (myPosition * 10)) : 100

  return (
    <div className="container lg:max-w-6xl relative pb-20 pt-8">
      {/* Feedback Modal Overlay */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-white p-8 max-w-sm w-full text-center border border-zinc-200 rounded-2xl shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6 border border-emerald-200 text-emerald-600">
                <span className="text-2xl">✓</span>
              </div>
              <h2 className="text-2xl font-bold text-zinc-950 mb-2 tracking-tight">Finished!</h2>
              <p className="text-slate-500 text-sm mb-8">Your session was successfully completed.</p>
              <button onClick={() => navigate('/')} className="w-full btn-primary py-4">
                Return to Home
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-6">
          {myQueueData ? (
            <motion.div layout className="bg-white border border-zinc-200 p-8 relative overflow-hidden flex flex-col items-center text-center shadow-lg rounded-2xl">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} className="h-full bg-teal-600 shadow-[0_0_10px_rgba(13,148,136,0.3)] transition-all duration-1000 ease-out" />
              </div>

              {isServing ? (
                <div className="py-8">
                  <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [1, 1.05, 1], opacity: 1 }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl mb-6 opacity-80">🎯</motion.div>
                  <h2 className="text-3xl font-black mb-2 text-zinc-950 tracking-tight leading-none">Your Turn!</h2>
                  <p className="text-teal-700 font-bold mb-8 uppercase tracking-widest text-xs">Please proceed to service area</p>
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex justify-between items-center mb-10">
                    <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">My Tracker</span>
                    <span className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-amber-200 bg-amber-50 text-amber-700">
                      {myQueueData.status}
                    </span>
                  </div>

                  <div className="relative mb-10 py-8 text-center rounded-2xl bg-slate-50 border border-zinc-100 shadow-inner">
                    <p className="text-7xl font-black text-zinc-950 leading-none tracking-tighter">#{myPosition}</p>
                    <p className="text-xs font-bold text-slate-400 mt-4 uppercase tracking-widest">Current Position</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-left">ETA</p>
                      <p className="text-2xl font-black text-zinc-950 tracking-tight text-left">{timer || '--:--'}</p>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-left">Time Slot</p>
                      <p className="text-lg font-black text-zinc-950 text-left uppercase whitespace-nowrap overflow-hidden text-ellipsis">
                        {myQueueData.estimatedStartTime ? new Date(myQueueData.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ASAP'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button onClick={handleLeave} className="mt-4 text-[11px] text-slate-400 hover:text-rose-600 font-bold uppercase tracking-widest transition-colors py-2 px-4 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100">
                Cancel Registration
              </button>
            </motion.div>
          ) : (
            <motion.div layout className="bg-white border border-zinc-200 p-10 relative overflow-hidden flex flex-col items-center text-center shadow-lg rounded-2xl">
              <p className="text-4xl mb-6 opacity-30">👀</p>
              <h2 className="text-2xl font-black text-zinc-950 mb-2 tracking-tight">Observing Feed</h2>
              <p className="text-slate-500 mb-8 text-sm leading-relaxed font-medium">You are viewing this Hub's live feed but are not currently participating.</p>
              <button onClick={() => navigate('/')} className="w-full py-4 rounded-xl bg-slate-50 border border-zinc-200 font-bold uppercase tracking-wider text-[10px] text-slate-500 hover:bg-slate-100 hover:text-zinc-950 transition-all shadow-xs">
                Return to Dashboard
              </button>
            </motion.div>
          )}
        </div>

        <div className="lg:col-span-7">
          <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-xl min-h-[500px]">
             {business && (
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8 pb-8 border-b border-zinc-100">
                <div>
                  <h1 className="text-3xl font-black text-zinc-950 tracking-tight leading-none mb-2">{business.name}</h1>
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-widest px-0.5">Virtual Pool Operations</p>
                </div>
                <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-2xl border border-zinc-100">
                  <div className="text-center">
                    <p className="text-2xl font-black text-zinc-950 leading-none mb-1">{users.length}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">In Live Pool</p>
                  </div>
                  <div className="w-px h-8 bg-zinc-200" />
                  <div className="text-center">
                    <p className="text-2xl font-black text-teal-700 leading-none mb-1">{business.averageServiceTime}m</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Avg Session</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {users.length === 0 ? (
                <div className="py-24 text-center rounded-2xl border-2 border-dashed border-zinc-100">
                  <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em]">Queue is currently clear</p>
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
