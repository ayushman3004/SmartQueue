import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getQueue, joinQueue, leaveQueue, getWaitEstimate } from '../api/queue.api'
import { getBusiness } from '../api/business.api'
import QueueCard from '../components/QueueCard'

const SERVICE_TYPES = ['general', 'banking', 'consultation', 'checkup', 'billing', 'support']

export default function QueuePage() {
  const { businessId } = useParams()
  const { user } = useAuth()
  const { joinRoom, leaveRoom, onQueueUpdate } = useSocket()
  const navigate = useNavigate()

  const [business, setBusiness] = useState(null)
  const [queue, setQueue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [serviceType, setServiceType] = useState('general')
  const [error, setError] = useState('')
  const [timer, setTimer] = useState('')

  // AI Estimation state
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
    fetchData()
    joinRoom(businessId)
    const unsub = onQueueUpdate((updatedQueue) => {
      setQueue(updatedQueue)
      estimationCacheRef.current = { data: null, timestamp: 0 }
      setEstimation(null)
    })
    return () => {
      leaveRoom(businessId)
      unsub?.()
    }
  }, [businessId, fetchData, joinRoom, leaveRoom, onQueueUpdate])

  // Feedback Trigger Logic
  useEffect(() => {
    if (loading) return
    const me = users.find(u => (u.userId?._id || u.userId)?.toString() === user?._id?.toString())
    if (prevInQueue.current && !me) {
      setShowFeedback(true)
    }
    prevInQueue.current = !!me
  }, [users, user, loading])

  // Countdown timer logic
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

  const handleJoin = async () => {
    setActionLoading(true)
    setError('')
    try {
      const res = await joinQueue(businessId, { serviceType })
      setQueue(res.data.data.queue)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join queue')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave the queue?')) return
    setActionLoading(true)
    try {
      const res = await leaveQueue(businessId)
      setQueue(res.data.data.queue)
      setEstimation(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to leave queue')
    } finally {
      setActionLoading(false)
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
      const data = res.data.data.estimation
      setEstimation(data)
      estimationCacheRef.current = { data, timestamp: Date.now() }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get estimate')
    } finally {
      setEstimating(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] page-wrapper">
      <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const progressPercent = myPosition > 0 ? Math.max(0, 100 - (myPosition * 10)) : 100

  if (!myQueueData && !showFeedback) {
    return (
      <div className="container py-20 text-center animate-in fade-in duration-700">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <p className="text-8xl mb-6">🏙️</p>
          <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">You are not in this queue</h2>
          <p className="text-neutral-500 mb-8 max-w-md mx-auto">Join the queue from the dashboard to track your live position and get AI-powered wait times.</p>
          <button onClick={() => navigate('/')} className="btn-primary">Browse All Hubs</button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="container py-8 max-w-7xl relative">
      {/* Feedback Modal Overlay */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-bright p-10 max-w-md w-full text-center relative border-white/20"
            >
              <div className="w-24 h-24 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-6 border-4 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                <span className="text-4xl animate-bounce">✨</span>
              </div>
              <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Service Finished!</h2>
              <p className="text-neutral-400 mb-8">Hope you loved the experience at the Hub. Rate your visit below.</p>
              
              <div className="mb-8">
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button 
                      key={s} 
                      onClick={() => setRating(s)}
                      className={`text-3xl transition-all hover:scale-125 ${s <= rating ? 'grayscale-0' : 'grayscale opacity-30'}`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
              </div>

              <textarea 
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-cyan-500 focus:outline-none mb-6 min-h-[100px] resize-none" 
                placeholder="Share your thoughts... (Optional)"
              />

              <button 
                onClick={() => navigate('/')}
                className="w-full py-5 rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 text-black font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-cyan-500/20"
              >
                Submit Feedback
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Navigation */}
      <motion.nav 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-12"
      >
        <button onClick={() => navigate('/')} className="group flex items-center gap-3 text-neutral-400 hover:text-white transition-colors">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-cyan-500/10 border border-white/5 transition-colors">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </div>
          <span className="text-xs font-black uppercase tracking-widest">Quit Queue</span>
        </button>
        <div className="flex items-center gap-4 py-2 px-4 rounded-full bg-cyan-500/5 border border-cyan-500/10">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
          <span className="text-[10px] font-black tracking-[0.2em] text-cyan-500 uppercase">Live Queue Sync</span>
        </div>
      </motion.nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: User Status & AI Analysis */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          
          {/* Main Status Hero Card */}
          {myQueueData && (
            <motion.div
              layoutId="status-card"
              className="glass-bright p-10 relative overflow-hidden flex flex-col items-center text-center shadow-2xl shadow-cyan-500/10 border-cyan-500/30"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-neutral-900">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-linear-to-r from-cyan-500 via-blue-500 to-purple-600 shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                />
              </div>

              {isServing ? (
                <div className="py-6">
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="text-6xl mb-4"
                  >
                    🚀
                  </motion.div>
                  <h2 className="text-3xl font-black mb-2 text-white uppercase tracking-tighter">You're Ready!</h2>
                  <p className="text-cyan-400 font-black mb-6 uppercase tracking-widest text-[10px]">Proceed to service area now</p>
                  <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-sm text-cyan-200">
                    A staff member is waiting for you at the counter.
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex justify-between items-center mb-8">
                    <span className="text-[10px] font-black tracking-widest text-neutral-500 uppercase">Estimated Turn</span>
                    <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-bold text-neutral-400 border border-white/10 uppercase">
                      {myQueueData.status}
                    </span>
                  </div>

                  <div className="relative mb-8">
                    <p className="text-[10rem] font-black leading-none tracking-tighter text-white opacity-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none">
                      #{myPosition}
                    </p>
                    <div className="bg-linear-to-b from-white to-neutral-400 bg-clip-text">
                      <p className="text-8xl font-black text-transparent leading-none">
                        #{myPosition}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-neutral-400 mt-2 uppercase tracking-widest opacity-50">Position in Queue</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-neutral-900/50 rounded-2xl p-4 border border-white/5">
                      <p className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Live Countdown</p>
                      <p className="text-2xl font-black text-white font-mono tracking-tight">{timer || '--:--'}</p>
                    </div>
                    <div className="bg-neutral-900/50 rounded-2xl p-4 border border-white/5">
                      <p className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Assigned Slot</p>
                      <p className="text-xl font-bold text-white">
                        {myQueueData.estimatedStartTime ? new Date(myQueueData.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Soon'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleEstimate}
                    disabled={estimating}
                    className="w-full py-4 rounded-2xl bg-linear-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 font-bold text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all group overflow-hidden relative"
                  >
                    <div className="absolute inset-0 bg-linear-to-r from-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    {estimating ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        Analyzing Hub traffic...
                      </span>
                    ) : (
                      '🧠 AI Deep Analysis'
                    )}
                  </button>
                </div>
              )}

              <button
                onClick={handleLeave}
                className="mt-6 text-xs text-neutral-500 hover:text-red-500 font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
              >
                Cancel Booking & Leave Queue
              </button>
            </motion.div>
          )}

          {/* AI Insights Card */}
          <AnimatePresence>
            {estimation && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="glass-bright p-6 bg-linear-to-br from-neutral-900 to-black border-cyan-500/40 relative overflow-hidden"
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-3xl" />
                
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  <span className="text-[10px] font-black text-cyan-500 tracking-widest uppercase">Smart ETA Analysis</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-4xl font-black text-white">{estimation.estimatedWait} <span className="text-xl font-normal text-neutral-500">mins</span></p>
                    <p className="text-xs text-neutral-400 mt-1">{estimation.message}</p>
                  </div>

                  <div className="flex gap-4 pt-4 border-t border-white/5">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Ahead of You</p>
                      <p className="text-lg font-black text-white">{estimation.peopleAhead} <span className="text-xs font-normal opacity-50">People</span></p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Wait Factor</p>
                      <p className={`text-lg font-black ${estimation.isPeakHour ? 'text-amber-500' : 'text-green-500'}`}>
                        {estimation.isPeakHour ? '🔥 PEAK' : '✨ NORMAL'}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: Live Queue List */}
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="glass p-8">
            {business && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h1 className="text-2xl font-black text-white flex items-center gap-3">
                    {business.name}
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-white/5 text-neutral-500 uppercase tracking-widest">
                      {business.category} Hub
                    </span>
                  </h1>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xl font-black text-white">{users.length}</p>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase">Total Queue</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="text-center">
                    <p className="text-xl font-black text-cyan-500">~{business.averageServiceTime}m</p>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase">Avg Wait</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
              {users.length === 0 ? (
                <div className="text-center py-24 bg-neutral-900/40 rounded-3xl border border-dashed border-white/5">
                  <div className="text-5xl mb-4 opacity-50">🎑</div>
                  <h3 className="text-lg font-bold text-white mb-1 uppercase tracking-widest">Hub is Quiet</h3>
                  <p className="text-sm text-neutral-500">No active queue. Direct entry available!</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {users.map((u, i) => (
                    <QueueCard
                      key={`${(u.userId?._id || u.userId)?.toString() || 'user'}-${i}`}
                      user={u}
                      position={i + 1}
                      isMe={(u.userId?._id || u.userId)?.toString() === user?._id?.toString()}
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
  )
}
