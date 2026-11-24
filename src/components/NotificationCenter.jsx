import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Bell, Building2, CalendarCheck, CheckCheck, CircleCheck, Clock3, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import socket from '../lib/socket'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notification.api'
import { getNotificationFeedback, readSessionFeedback, subscribeToFeedback } from '../modules/notification/browser-feedback'
import './NotificationCenter.css'

const icons = { hub: Building2, booking: CalendarCheck, queue: Clock3, account: Bell, feedback: CircleCheck }
const timestamp = value => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function NotificationInbox() {
  const navigate = useNavigate()
  const panelId = useId()
  const trigger = useRef(null)
  const panel = useRef(null)
  const request = useRef(null)
  const [open, setOpen] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [data, setData] = useState({ notifications: [], unreadCount: 0, nextCursor: null })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [top, setTop] = useState(64)
  const sessionInbox = useSyncExternalStore(subscribeToFeedback, () => getNotificationFeedback().inbox)
  const unreadCount = data.unreadCount + sessionInbox.filter(entry => !entry.readAt).length
  const notifications = [...data.notifications, ...sessionInbox.filter(entry => !unreadOnly || !entry.readAt)]
    .sort((first, second) => +new Date(second.createdAt) - +new Date(first.createdAt))

  const load = useCallback(async (before) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    try {
      const response = await getNotifications({ unread: unreadOnly, ...(before ? { before } : {}) }, controller.signal)
      if (controller.signal.aborted) return
      const next = response.data.data
      setData(previous => ({ ...next, notifications: before ? [...previous.notifications, ...next.notifications] : next.notifications }))
      setError('')
    } catch (err) {
      if (!controller.signal.aborted) setError(err.response?.status === 404 ? 'The notification service needs a backend restart. Please retry shortly.' : err.response?.data?.message || 'Could not load notifications. Please retry.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [unreadOnly])

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load() }
    void load()
    socket.on('notification:created', refresh)
    socket.on('notification:read', refresh)
    socket.on('connect', refresh)
    document.addEventListener('visibilitychange', refresh)
    const interval = setInterval(refresh, 60000)
    return () => {
      request.current?.abort()
      clearInterval(interval)
      socket.off('notification:created', refresh)
      socket.off('notification:read', refresh)
      socket.off('connect', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  useEffect(() => {
    if (!open) return
    const position = () => setTop(Math.min(trigger.current.getBoundingClientRect().bottom + 10, window.innerHeight - 160))
    position()
    panel.current?.querySelector('button')?.focus()
    const outside = event => {
      if (!panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false)
    }
    const escape = event => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    document.addEventListener('focusin', outside)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      document.removeEventListener('focusin', outside)
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open])

  const read = async (notification) => {
    if (busy) return
    if (notification.type === 'feedback') {
      readSessionFeedback(notification._id)
      return
    }
    setBusy(true)
    try {
      if (!notification.readAt) await markNotificationRead(notification._id)
      await load()
      // Only internal, server-authored destinations are accepted.
      if (/^\/(?!\/)/.test(notification.href) && !/[\\\s]/.test(notification.href)) {
        setOpen(false)
        navigate(notification.href)
      }
    } catch {
      setError('Could not mark this notification as read. Please retry.')
    } finally { setBusy(false) }
  }

  const readAll = async () => {
    readSessionFeedback()
    if (!data.unreadCount) return
    setBusy(true)
    try { await markAllNotificationsRead(); await load() }
    catch { setError('Could not mark notifications as read. Please retry.') }
    finally { setBusy(false) }
  }

  return <>
    <button ref={trigger} type="button" className="notification-bell" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}
      onClick={() => { setOpen(value => !value); if (!open) void load() }}>
      <Bell size={19} aria-hidden="true" />
      {unreadCount > 0 && <span className="notification-count" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && createPortal(<section ref={panel} id={panelId} role="dialog" aria-label="Notifications" className="notification-panel" style={{ top, maxHeight: `calc(100dvh - ${top + 12}px - env(safe-area-inset-bottom))` }}>
      <div className="notification-heading"><div><h2>Notifications</h2><p>{unreadCount ? `${unreadCount} unread updates` : error ? 'Updates unavailable' : loading ? 'Checking for updates…' : 'You’re all caught up'}</p></div>
        <button type="button" className="notification-close" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus() }}><X size={18} /></button>
      </div>
      <div className="notification-toolbar">
        <div className="notification-filters" aria-label="Filter notifications">
          <button type="button" aria-pressed={!unreadOnly} onClick={() => { if (unreadOnly) { setData(previous => ({ ...previous, notifications: [], nextCursor: null })); setUnreadOnly(false) } }}>All</button>
          <button type="button" aria-pressed={unreadOnly} onClick={() => { if (!unreadOnly) { setData(previous => ({ ...previous, notifications: [], nextCursor: null })); setUnreadOnly(true) } }}>Unread</button>
        </div>
        <button type="button" className="notification-read-all" disabled={busy || !unreadCount} onClick={readAll}><CheckCheck size={15} /> Mark all read</button>
      </div>
      {error && <div className="notification-error" role="alert">{error}<button type="button" onClick={() => load()}>Retry</button></div>}
      <div className="notification-list" aria-busy={loading}>
        {loading && !notifications.length ? <p className="notification-empty" role="status">Loading notifications…</p> : !notifications.length && !error ? <div className="notification-empty"><Bell size={26} /><h3>{unreadOnly ? 'No unread notifications' : 'No notifications yet'}</h3><p>Hub, booking, and queue updates will appear here.</p></div> : null}
        {notifications.map(notification => {
          const Icon = icons[notification.type] || Bell
          return <button key={notification._id} type="button" className="notification-item" data-unread={!notification.readAt} disabled={busy} onClick={() => read(notification)}>
            <span className="notification-icon"><Icon size={18} /></span>
            <span className="notification-copy"><span className="notification-title">{notification.title}{!notification.readAt && <span className="notification-dot" aria-label="Unread" />}</span><span className="notification-message">{notification.message}</span><time dateTime={notification.createdAt}>{timestamp(notification.createdAt)}</time></span>
          </button>
        })}
        {data.nextCursor && <button type="button" className="notification-more" disabled={loading || busy} onClick={() => load(data.nextCursor)}>{loading ? 'Loading…' : 'Load older updates'}</button>}
      </div>
    </section>, document.body)}
  </>
}

export default function NotificationCenter() {
  const { user } = useAuth()
  if (!user?._id || ['INVITED', 'EXPIRED', 'PASSWORD_REQUIRED', 'SUSPENDED'].includes(user.ownerAccess?.status)) return null
  return <NotificationInbox key={user._id} />
}
