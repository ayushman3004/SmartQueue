import { useEffect, useRef } from 'react'
import { activateDialog } from '../utils/dialogBehavior'

export function useDialog(open, onClose, mobileOnly = false) {
  const ref = useRef(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    if (!open || !ref.current) return
    const release = activateDialog(ref.current, () => close.current())
    const desktop = window.matchMedia('(min-width: 1024px)')
    const changed = () => { if (mobileOnly && desktop.matches) close.current() }
    if (mobileOnly) desktop.addEventListener('change', changed)
    changed()
    return () => { release(); desktop.removeEventListener('change', changed) }
  }, [open, mobileOnly])
  return ref
}
