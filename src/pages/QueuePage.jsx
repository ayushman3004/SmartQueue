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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="container lg:max-w-6xl pb-20 pt-8">

      {/* DELAY ALERT */}
      {delayInfo && (
        <div className="bg-red-50 p-4 mb-4 rounded-xl border">
          Delay: {delayInfo?.delay} mins
          <button onClick={handleHandleDelay}>Cancel</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT SIDE */}
        <div className="lg:col-span-5">

          {myQueueData ? (
            <div className="bg-white p-6 rounded-xl shadow">

              {isServing ? (
                <h2>Your Turn 🎯</h2>
              ) : (
                <>
                  <h2>Position #{myPosition}</h2>
                  <p>ETA: {timer || '--'}</p>
                  <p>Status: {myQueueData?.status}</p>
                </>
              )}

              <button onClick={handleLeave}>
                Leave Queue
              </button>
            </div>

          ) : (
            <div className="bg-white p-6 rounded-xl shadow">
              <h2>Not in queue</h2>
              <button onClick={() => navigate('/')}>
                Go Back
              </button>
            </div>
          )}

        </div>

        {/* RIGHT SIDE */}
        <div className="lg:col-span-7">

          <div className="bg-white p-6 rounded-xl shadow">

            <h1>{business?.name || 'Business'}</h1>
            <p>Total: {users.length}</p>

            {users.length === 0 ? (
              <p>No users</p>
            ) : (
              users.map((u, i) => (
                <QueueCard
                  key={(u.userId?._id || u.userId)?.toString() || i}
                  user={u}
                  position={i + 1}
                  isMe={
                    (u.userId?._id || u.userId)?.toString() === user?._id?.toString()
                  }
                />
              ))
            )}

          </div>

        </div>
      </div>
    </div>
  )
}