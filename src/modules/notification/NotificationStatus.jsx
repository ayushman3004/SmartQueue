import { useSyncExternalStore } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import {
  dismissFeedback,
  getNotificationFeedback,
  pageNotificationScope,
  queueNotificationScope,
  sessionNotificationScope,
  subscribeToFeedback,
} from './browser-feedback'
import './notification-status.css'

const icons = { success: CheckCircle2, error: CircleAlert, info: Info }

function Message({ scope, entry }) {
  const Icon = icons[entry.level]
  return <div className="notification-status-message" data-level={entry.level}>
    <Icon size={18} aria-hidden="true" />
    <div>
      <span>{entry.message}</span>
      {entry.href && <Link to={entry.href} onClick={() => dismissFeedback(scope)}>View queue</Link>}
    </div>
    <button type="button" onClick={() => dismissFeedback(scope)} aria-label="Dismiss message"><X size={16} aria-hidden="true" /></button>
  </div>
}

export default function NotificationStatus({ scope, sticky = false }) {
  const entry = useSyncExternalStore(subscribeToFeedback, () => getNotificationFeedback().notices.get(scope))
  return <div className={sticky ? 'notification-status notification-status-sticky' : 'notification-status'}>
    <div role="alert" aria-atomic="true">{entry?.level === 'error' && <Message key={entry._id} entry={entry} scope={scope} />}</div>
    <div role="status" aria-atomic="true">{entry && entry.level !== 'error' && <Message key={entry._id} entry={entry} scope={scope} />}</div>
  </div>
}

export function PageNotificationStatus({ belowHeader = false }) {
  const { pathname } = useLocation()
  return <div className="notification-status-page" data-below-header={belowHeader}>
    <NotificationStatus scope={sessionNotificationScope} />
    <NotificationStatus scope={queueNotificationScope} />
    <NotificationStatus scope={pageNotificationScope(pathname)} />
  </div>
}
