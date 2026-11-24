const MAX_SESSION_NOTIFICATIONS = 30
const listeners = new Set()
const emptyFeedback = () => ({ notices: new Map(), inbox: [] })

export const sessionNotificationScope = 'session'
export const queueNotificationScope = 'queue-activity'
export const pageNotificationScope = pathname => `page:${pathname}`

let feedback = emptyFeedback()
let account = null
let revision = 0
let nextId = 0

function update(next) {
  feedback = next
  listeners.forEach(listener => listener())
}

export function subscribeToFeedback(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getNotificationFeedback = () => feedback
export const getFeedbackRevision = () => revision

export function setFeedbackAccount(id) {
  const next = id ? String(id) : null
  if (account === next) return
  account = next
  revision += 1
  update(emptyFeedback())
}

export function publishFeedback(scope, level, message, { inbox = level === 'success', href = '' } = {}) {
  if (!message) return
  const current = feedback.notices.get(scope)
  if (current?.message === message && current.level === level && current.href === href) return

  const entry = {
    _id: `session-${++nextId}`,
    type: 'feedback',
    title: 'Action confirmation',
    message,
    level,
    href,
    createdAt: new Date().toISOString(),
    readAt: null,
  }
  const notices = new Map(feedback.notices)
  notices.set(scope, entry)
  update({
    notices,
    inbox: inbox && account ? [entry, ...feedback.inbox].slice(0, MAX_SESSION_NOTIFICATIONS) : feedback.inbox,
  })
}

export function createNotificationFeedback(scope, sessionRevision = getFeedbackRevision()) {
  const publish = (level, message, options) => {
    if (sessionRevision === getFeedbackRevision()) publishFeedback(scope, level, message, options)
  }
  return {
    success: (message, options) => publish('success', message, options),
    error: message => publish('error', message),
    info: (message, options) => publish('info', message, options),
    dismiss: () => {
      if (sessionRevision === getFeedbackRevision()) dismissFeedback(scope)
    },
  }
}

export function dismissFeedback(scope) {
  if (!feedback.notices.has(scope)) return
  const notices = new Map(feedback.notices)
  notices.delete(scope)
  update({ ...feedback, notices })
}

export function readSessionFeedback(id) {
  const readAt = new Date().toISOString()
  const inbox = feedback.inbox.map(entry => !entry.readAt && (!id || entry._id === id) ? { ...entry, readAt } : entry)
  update({ ...feedback, inbox })
}
