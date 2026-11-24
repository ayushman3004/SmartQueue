import { useEffect, useId, useMemo, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import {
  createNotificationFeedback,
  dismissFeedback,
  getFeedbackRevision,
  pageNotificationScope,
  sessionNotificationScope,
  subscribeToFeedback,
} from './browser-feedback'

function useFeedbackForScope(scope) {
  const revision = useSyncExternalStore(subscribeToFeedback, getFeedbackRevision)
  return useMemo(() => createNotificationFeedback(scope, revision), [scope, revision])
}

export function useNotificationFeedback() {
  const { pathname } = useLocation()
  return useFeedbackForScope(pageNotificationScope(pathname))
}

export function useSessionFeedback() {
  return useFeedbackForScope(sessionNotificationScope)
}

export function useInlineFeedback(open = true) {
  const scope = useId()
  const feedback = useFeedbackForScope(scope)
  useEffect(() => {
    dismissFeedback(scope)
    if (open) return () => dismissFeedback(scope)
  }, [open, scope])
  return [feedback, scope]
}
