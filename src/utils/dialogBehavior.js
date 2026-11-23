const locks = new WeakMap()
const focusable = 'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

// Shared by drawers and dialogs so nested overlays cannot unlock the page early.
export function activateDialog(dialog, onClose, allowOutsideFocus = () => false) {
  const doc = dialog.ownerDocument
  const view = doc.defaultView
  const previousFocus = doc.activeElement
  let lock = locks.get(doc)
  if (!lock) {
    const body = doc.body
    const keys = ['overflow', 'position', 'top', 'left', 'right', 'width']
    lock = { stack: [], x: view.scrollX, y: view.scrollY, styles: Object.fromEntries(keys.map(key => [key, body.style[key]])) }
    locks.set(doc, lock)
    Object.assign(body.style, { overflow: 'hidden', position: 'fixed', top: `-${lock.y}px`, left: '0', right: '0', width: '100%' })
  }
  lock.stack.push(dialog)
  const controls = () => [...dialog.querySelectorAll(focusable)].filter(node => node.getClientRects().length && node.getAttribute('aria-hidden') !== 'true')
  const focusFirst = () => (controls()[0] || dialog).focus({ preventScroll: true })
  const keydown = event => {
    if (lock.stack.at(-1) !== dialog) return
    if (allowOutsideFocus(event.target)) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
    if (event.key !== 'Tab') return
    const nodes = controls()
    const first = nodes[0]
    const last = nodes.at(-1)
    if (!first) { event.preventDefault(); dialog.focus(); return }
    if (event.shiftKey && (doc.activeElement === first || !dialog.contains(doc.activeElement))) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (doc.activeElement === last || !dialog.contains(doc.activeElement))) { event.preventDefault(); first.focus() }
  }
  const focusin = event => {
    if (lock.stack.at(-1) === dialog && !dialog.contains(event.target) && !allowOutsideFocus(event.target)) focusFirst()
  }
  doc.addEventListener('keydown', keydown)
  doc.addEventListener('focusin', focusin)
  focusFirst()
  return () => {
    doc.removeEventListener('keydown', keydown)
    doc.removeEventListener('focusin', focusin)
    lock.stack = lock.stack.filter(node => node !== dialog)
    if (!lock.stack.length) {
      Object.assign(doc.body.style, lock.styles)
      locks.delete(doc)
      const behavior = doc.documentElement.style.scrollBehavior
      doc.documentElement.style.scrollBehavior = 'auto'
      view.scrollTo(lock.x, lock.y)
      doc.documentElement.style.scrollBehavior = behavior
    }
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  }
}
