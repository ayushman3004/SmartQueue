import { useEffect, useRef } from 'react'
import { activateDialog } from '../utils/dialogBehavior'

export function useDialog(open, onClose, mobileOnly = false, allowOutsideFocus) {
  const ref = useRef(null)
  const close = useRef(onClose)
  const externalFocus = useRef(allowOutsideFocus)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => { externalFocus.current = allowOutsideFocus }, [allowOutsideFocus])
  useEffect(() => {
    if (!open || !ref.current) return
    const release = activateDialog(ref.current, () => close.current(), target => externalFocus.current?.(target))
    const desktop = window.matchMedia('(min-width: 1024px)')
    const changed = () => { if (mobileOnly && desktop.matches) close.current() }
    if (mobileOnly) desktop.addEventListener('change', changed)
    changed()
    return () => { release(); desktop.removeEventListener('change', changed) }
  }, [open, mobileOnly])
  return ref
}
