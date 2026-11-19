import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import '../styles/venue-sort.css'

const options = [
  { value: 'nearest', label: 'Nearest' },
  { value: 'wait_time', label: 'Shortest Wait' },
  { value: 'rating', label: 'Top Rated' },
]

export default function VenueSortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const menuId = useId()
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))

  useEffect(() => {
    if (!open) return
    optionRefs.current[focusedIndex]?.focus()
    const dismiss = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open, focusedIndex])

  const showMenu = index => {
    setFocusedIndex(index)
    setOpen(true)
  }
  const closeMenu = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={rootRef} className="venue-sort" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <button
        ref={triggerRef}
        type="button"
        className="venue-sort-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => open ? closeMenu() : showMenu(selectedIndex)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            showMenu(event.key === 'ArrowUp' ? options.length - 1 : selectedIndex)
          }
        }}
      >
        <span className="venue-sort-label">Sort by:</span>
        <span className="venue-sort-value">{options[selectedIndex].label}</span>
        <ChevronDown size={16} aria-hidden="true" className={open ? 'venue-sort-chevron-open' : undefined} />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Sort venues" className="venue-sort-menu" onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            closeMenu()
          } else if (event.key === 'Tab') {
            // Restore the trigger before the browser moves to the next control.
            closeMenu()
          } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            setFocusedIndex(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
              : (focusedIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
          } else if (event.key.length === 1 && /[a-z]/i.test(event.key)) {
            const index = options.findIndex(option => option.label.toLowerCase().startsWith(event.key.toLowerCase()))
            if (index >= 0) { event.preventDefault(); setFocusedIndex(index) }
          }
        }}>
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={element => { optionRefs.current[index] = element }}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              tabIndex={-1}
              className="venue-sort-option"
              onClick={() => { onChange(option.value); closeMenu() }}
            >
              <span>{option.label}</span>
              {value === option.value && <Check size={17} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
