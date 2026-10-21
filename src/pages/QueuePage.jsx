import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { Clock, User, Users, CheckCircle, Sparkles, Activity } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getQueue, leaveQueue, cancelDelay } from '../api/queue.api'
import { getBusiness } from '../api/business.api'
import { submitReview } from '../api/review.api'
import QueueCard from '../components/QueueCard'
import { toast } from 'react-hot-toast'
import { useSeo } from '../utils/useSeo'

export default function QueuePage() {
  const { businessId } = useParams()
  const { user } = useAuth()
  const { socket, joinRoom, joinUser, leaveRoom, onQueueUpdate, onQueueDelay, onBusinessStatus, connected } = useSocket()
  const navigate = useNavigate()

  const [business, setBusiness] = useState(null)
  const [queue, setQueue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [timer, setTimer] = useState('')
  const [delayInfo, setDelayInfo] = useState(null)
  const [completedBooking, setCompletedBooking] = useState(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)

  useSeo({
    title: business?.name ? `${business.name} — Live Queue Pass` : 'Live Queue Pass',
    description: 'Track your live queue position, estimated wait time, and counter status in real time.',
    robots: 'noindex, nofollow',
  })

  const users = queue?.users || []

  // SAFE myQueueData
  const myQueueData = user?._id
    ? users.find(
        u => (u.userId?._id || u.userId)?.toString() === user._id.toString()
      )
    : null

  const myPosition = myQueueData ? users.indexOf(myQueueData) + 1 : 0
  const isServing = myQueueData?.status === 'serving'

  const staffName = (myQueueData?.assignedStaff?.name || '').toLowerCase().trim()
  const myStaffQueue = staffName
    ? users.filter((u) => (u.assignedStaff?.name || '').toLowerCase().trim() === staffName)
    : users
  const myStaffPosition = myQueueData ? myStaffQueue.indexOf(myQueueData) + 1 : 0
  const peopleAheadInStaffQueue = Math.max(0, myStaffPosition - 1)

  // Next Live Queue Slot calculation with 15-minute buffer
  const nextSlotInfo = useMemo(() => {
    if (!users || users.length === 0) return { nextSlotTimeStr: null, estWaitMins: 0 }
    const BUFFER_MINS = 15
    const serving = users.find((u) => u.status === 'serving') || users[0]
    let startMs = serving.estimatedStartTime
      ? new Date(serving.estimatedStartTime).getTime()
      : serving.joinedAt
      ? new Date(serving.joinedAt).getTime()
      : Date.now()
    let finishMs = startMs + (Number(serving.serviceTime) || business?.averageServiceTime || 15) * 60000

    for (let i = 1; i < users.length; i++) {
      const u = users[i]
      const uStartMs = Math.max(Date.now(), finishMs + BUFFER_MINS * 60000)
      finishMs = uStartMs + (Number(u.serviceTime) || business?.averageServiceTime || 15) * 60000
    }

    const nextSlotMs = Math.max(Date.now(), finishMs) + BUFFER_MINS * 60000
    const nextSlotDate = new Date(nextSlotMs)
    return {
      nextSlotTimeStr: nextSlotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      estWaitMins: Math.max(1, Math.round((nextSlotMs - Date.now()) / 60000)),
    }
  }, [users, business?.averageServiceTime])

  // Group live queues by staff member
  const staffGroups = useMemo(() => {
    const rawStaff = Array.isArray(business?.staff) ? [...business.staff] : []

    // Collect any staff assigned to active users that aren't in rawStaff
    users.forEach((u) => {
      const sName = u.assignedStaff?.name
      if (
        sName &&
        !rawStaff.some((st) => st.name?.toLowerCase().trim() === sName.toLowerCase().trim())
      ) {
        rawStaff.push({
          name: sName,
          role: u.assignedStaff.role || (business?.category === 'clinic' ? 'Doctor / Specialist' : 'Specialist'),
          specialties: u.assignedStaff.specialties || '',
        })
      }
    })

    // If no staff found at all, create a single default on-duty staff
    if (rawStaff.length === 0) {
      rawStaff.push({
        name: business?.category === 'clinic' ? 'Dr. On-Duty (General Physician)' : 'On-Duty Specialist',
        role: business?.category === 'clinic' ? 'General Physician' : 'Barber / Stylist',
        specialties: '',
      })
    }

    const BUFFER_MINS = 15

    const groups = rawStaff.map((st) => {
      const staffKey = (st.name || '').toLowerCase().trim()
      const staffUsers = users.filter((u) => {
        const uStaff = (u.assignedStaff?.name || '').toLowerCase().trim()
        return uStaff === staffKey || (!uStaff && rawStaff.length === 1)
      })

      const servingUser = staffUsers.find((u) => u.status === 'serving')
      const waitingUsers = staffUsers.filter((u) => u.status === 'waiting')
      const isServing = Boolean(servingUser)
      const isMyStaff = Boolean(
        myQueueData && (myQueueData.assignedStaff?.name || '').toLowerCase().trim() === staffKey
      )

      let nextSlotStr = 'Immediate'
      let waitMins = 0

      if (isServing && servingUser) {
        let headStartMs = servingUser.estimatedStartTime
          ? new Date(servingUser.estimatedStartTime).getTime()
          : servingUser.joinedAt
          ? new Date(servingUser.joinedAt).getTime()
          : Date.now()

        let runningFinishMs =
          headStartMs + (Number(servingUser.serviceTime) || business?.averageServiceTime || 15) * 60000

        for (let i = 0; i < waitingUsers.length; i++) {
          const u = waitingUsers[i]
          const uStartMs = Math.max(Date.now(), runningFinishMs + BUFFER_MINS * 60000)
          const uDurationMs = (Number(u.serviceTime) || business?.averageServiceTime || 15) * 60000
          runningFinishMs = uStartMs + uDurationMs
        }

        const effectiveFinishMs = Math.max(Date.now(), runningFinishMs)
        const nextSlotMs = effectiveFinishMs + BUFFER_MINS * 60000
        waitMins = Math.max(1, Math.round((nextSlotMs - Date.now()) / 60000))
        nextSlotStr = new Date(nextSlotMs).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      }

      return {
        staff: st,
        staffKey,
        staffUsers,
        servingUser,
        waitingUsers,
        totalCount: staffUsers.length,
        isServing,
        isMyStaff,
        nextSlotStr,
        waitMins,
      }
    })

    // Also include an unassigned group if there are tickets without staff and multiple staff exist
    const assignedStaffKeys = new Set(rawStaff.map((s) => (s.name || '').toLowerCase().trim()))
    const unassignedUsers = users.filter(
      (u) => !u.assignedStaff?.name || !assignedStaffKeys.has(u.assignedStaff.name.toLowerCase().trim())
    )

    if (unassignedUsers.length > 0 && rawStaff.length > 1) {
      groups.push({
        staff: {
          name: 'General Queue Desk',
          role: 'Unassigned Queue',
        },
        staffKey: '__unassigned__',
        staffUsers: unassignedUsers,
        servingUser: unassignedUsers.find((u) => u.status === 'serving'),
        waitingUsers: unassignedUsers.filter((u) => u.status === 'waiting'),
        totalCount: unassignedUsers.length,
        isServing: unassignedUsers.some((u) => u.status === 'serving'),
        isMyStaff: false,
        nextSlotStr: 'Next Available',
        waitMins: 15,
      })
    }

    return groups
  }, [business?.staff, business?.category, business?.averageServiceTime, users, myQueueData])

  // FETCH DATA
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

  // INITIAL DATA FETCH (runs regardless of socket state)
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // SOCKET SETUP (re-fetches when socket connects for freshest data)
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

    const handleServiceCompleted = (data) => {
      const uId = data.userId?._id || data.userId;
      if (uId?.toString() === user?._id?.toString()) {
        setCompletedBooking(data.booking || { businessId, serviceType: 'Completed Service' })
        toast.success('Your service is completed! Please rate your experience.')
      }
    }
    socket?.on('service:completed', handleServiceCompleted)

    return () => {
      leaveRoom(businessId)
      unsubUpdate?.()
      unsubDelay?.()
      unsubStatus?.()
      socket?.off('service:completed', handleServiceCompleted)
    }
  }, [businessId, fetchData, connected, user])

  // TIMER FIX
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

  // LEAVE QUEUE
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

  // CANCEL DELAY WITH FULL REFUND
  const handleCancelDelay = async () => {
    if (!window.confirm('Cancel your queue booking and request an automated refund due to service delay?')) return

    setActionLoading(true)
    try {
      await cancelDelay(businessId)
      setDelayInfo(null)
      toast.success('Queue booking cancelled and refunded successfully.')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel delay')
    } finally {
      setActionLoading(false)
    }
  }

  // SUBMIT REVIEW
  const handleQueueReviewSubmit = async (e) => {
    e.preventDefault()
    setSubmittingReview(true)
    try {
      await submitReview({
        bookingId: completedBooking?._id || undefined,
        businessId,
        rating: reviewRating,
        comment: reviewComment,
      })
      setReviewSubmitted(true)
      toast.success('Thank you! Your rating has been recorded.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error submitting review')
    } finally {
      setSubmittingReview(false)
    }
  }

  // LOADING UI
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
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-black text-amber-700 shadow-xs border border-amber-100">!</div>
              <div>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-0.5">Queue Delay Detected</p>
                <p className="text-xs font-bold text-amber-600">Service delayed by {delayInfo?.delay || 0} minutes. You may cancel for a full refund.</p>
              </div>
            </div>
            <button
              onClick={handleCancelDelay}
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all active:scale-95 shadow-xs whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Processing...' : 'Cancel & Refund'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">

        {/* LEFT COLUMN — Your Status */}
        <div className="lg:col-span-4 space-y-6">

          {completedBooking ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bezel-shell"
            >
              <div className="bezel-core p-7 space-y-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto text-xl font-black">
                  
                </div>
                <div>
                  <span className="badge-eyebrow bg-emerald-50 text-emerald-800 border-emerald-200">
                    Service Completed
                  </span>
                  <h3 className="text-xl font-black text-zinc-950 mt-1">
                    How was your experience?
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Rate and review your visit at {business?.name || 'this hub'}.
                  </p>
                </div>

                {reviewSubmitted ? (
                  <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 font-bold text-xs space-y-2">
                    <p>Thank you for submitting your rating!</p>
                    <button
                      onClick={() => navigate('/customers')}
                      className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700"
                    >
                      View Service History →
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleQueueReviewSubmit} className="space-y-4 text-left">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-zinc-500 mb-1">Rating</label>
                      <div className="flex items-center gap-1.5 justify-center py-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setReviewRating(star)}
                            className={`text-2xl transition-transform hover:scale-125 ${star <= reviewRating ? 'text-amber-400' : 'text-zinc-200'}`}
                          >
                            
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-zinc-500 mb-1">Feedback</label>
                      <textarea
                        rows={3}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Share your thoughts on the care, wait time, or service..."
                        className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-xs disabled:opacity-50"
                    >
                      {submittingReview ? 'Submitting...' : 'Submit Rating'}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          ) : myQueueData ? (
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
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-300 flex items-center justify-center text-emerald-700 shadow-xs">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <span className="badge-eyebrow bg-emerald-50 text-emerald-700 border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-radar" />
                          Ready For You
                        </span>
                        <h2 className="text-2xl font-black text-zinc-950 tracking-tight leading-none mt-1">Your Turn!</h2>
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-center shadow-xs mb-6">
                      <p className="text-xs font-black text-emerald-700 uppercase tracking-wider">Please proceed to service desk</p>
                      {myQueueData?.assignedStaff?.name && (
                        <p className="text-xs font-black text-emerald-900 mt-2">
                          {business?.category === 'clinic' ? 'Assigned Doctor:' : 'Assigned Specialist:'} {myQueueData.assignedStaff.name} {myQueueData.assignedStaff.role ? `(${myQueueData.assignedStaff.role})` : ''}
                        </p>
                      )}
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
                        {myQueueData?.assignedStaff?.name && (
                          <p className="text-[11px] text-teal-700 font-bold mt-1">
                            Position #{myStaffPosition} for {myQueueData.assignedStaff.name} ({peopleAheadInStaffQueue} ahead)
                          </p>
                        )}
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
                      <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/70 mb-3 text-left">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-teal-600 mb-0.5">Selected Service</p>
                        <p className="text-xs font-black text-teal-900">{myQueueData.serviceType}</p>
                      </div>
                    )}

                    {myQueueData?.assignedStaff?.name && (
                      <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/70 mb-5 text-left">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-teal-600 mb-0.5">
                          {business?.category === 'clinic' ? 'Assigned Doctor' : 'Assigned Specialist'}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-black text-teal-900">{myQueueData.assignedStaff.name}</p>
                          {myQueueData.assignedStaff.role && (
                            <span className="text-[10px] text-teal-700 font-medium">({myQueueData.assignedStaff.role})</span>
                          )}
                          {myQueueData.assignedStaff.autoAssigned && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">
                              Auto
                            </span>
                          )}
                        </div>
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

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="bg-zinc-50 border border-zinc-200/80 px-4 py-2 rounded-2xl flex items-baseline gap-1.5 shadow-xs">
                    <span className="text-xl font-black text-zinc-950">{users.length}</span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">In Line</span>
                  </div>
                  {nextSlotInfo.nextSlotTimeStr && (
                    <div className="bg-emerald-50 border border-emerald-200/80 px-3.5 py-1.5 rounded-2xl flex items-center gap-2 shadow-xs">
                      <Clock className="w-3.5 h-3.5 text-emerald-700" />
                      <div className="text-left">
                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Next Live Slot</p>
                        <p className="text-xs font-black text-emerald-800 leading-tight">
                          {nextSlotInfo.nextSlotTimeStr} <span className="text-[10px] font-medium text-emerald-600">(+15m buf)</span>
                        </p>
                      </div>
                    </div>
                  )}
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

              {/* Queue Columns — Flex Column-wise for Staff */}
              {users.length === 0 ? (
                <div className="text-center py-16 bg-zinc-50/60 rounded-2xl border border-dashed border-zinc-200">
                  <p className="text-xs font-black text-zinc-700 uppercase tracking-wider">Queue Is Currently Clear</p>
                  <p className="text-[11px] text-zinc-400 mt-1">Immediate service available upon check-in.</p>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-4 items-stretch overflow-x-auto pb-3">
                  {staffGroups.map((group) => {
                    const st = group.staff
                    const staffUsers = group.staffUsers

                    return (
                      <div
                        key={group.staffKey}
                        className={`flex-1 min-w-[270px] sm:min-w-[300px] rounded-2xl border transition-all flex flex-col justify-between overflow-hidden ${
                          group.isMyStaff
                            ? 'bg-teal-50/20 border-teal-300 shadow-sm ring-1 ring-teal-500/20'
                            : 'bg-zinc-50/60 border-zinc-200/90'
                        }`}
                      >
                        {/* Staff Header */}
                        <div className="px-3.5 py-3 bg-white border-b border-zinc-100 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border ${
                                  group.isMyStaff
                                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                    : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                }`}
                              >
                                <User className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="font-black text-sm text-zinc-950 tracking-tight truncate">
                                    {st.name}
                                  </h3>
                                  {group.isMyStaff && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200 shrink-0">
                                      Your Queue
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10.5px] text-zinc-500 font-medium truncate">
                                  {st.role || (business?.category === 'clinic' ? 'Doctor / Specialist' : 'Specialist')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100/70">
                            {/* Staff Live Status Badge */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 border shadow-2xs ${
                                group.isServing
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  group.isServing ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                                }`}
                              />
                              <span>
                                {group.isServing ? 'Serving Now' : 'Queue Clear'}
                              </span>
                            </span>

                            <span className="px-2 py-0.5 rounded-lg bg-white border border-zinc-200 text-[10px] font-bold text-zinc-700 shadow-2xs">
                              {staffUsers.length} in line
                            </span>
                          </div>
                        </div>

                        {/* Tickets Queue Under This Staff Member */}
                        <div className="p-3 space-y-2 flex-1 flex flex-col justify-start">
                          {staffUsers.length === 0 ? (
                            <div className="py-8 px-3 bg-white/60 rounded-xl border border-dashed border-zinc-200 text-center flex-1 flex flex-col items-center justify-center">
                              <p className="text-[11px] font-bold text-zinc-500">
                                No patrons waiting for {st.name}
                              </p>
                              <p className="text-[10px] text-zinc-400 mt-0.5">
                                Next check-in starts immediately.
                              </p>
                            </div>
                          ) : (
                            <AnimatePresence>
                              {staffUsers.map((u) => {
                                const overallPosition = users.indexOf(u) + 1
                                const isMe = (u.userId?._id || u.userId)?.toString() === user?._id?.toString()

                                return (
                                  <QueueCard
                                    key={(u.userId?._id || u.userId)?.toString() || overallPosition}
                                    user={u}
                                    position={overallPosition}
                                    isMe={isMe}
                                    totalUsers={users.length}
                                  />
                                )
                              })}
                            </AnimatePresence>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}