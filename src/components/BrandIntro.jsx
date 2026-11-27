import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './BrandIntro.css'

const STORAGE_KEY = 'serveq-brand-intro-seen'
const LOGO = '/serveq-logo.png'
const LOGO_WIDTH = 1636
const LOGO_HEIGHT = 746
const INTRO_DURATION_MS = 2600
let introSeen = false

// The circle bounds are measured in the cropped logo's pixel coordinates.
const circles = [
  { bounds: [0, 144, 401, 405], color: '#047857', from: ['-32vw', '-9vh'], drift: ['-29vw', '-13vh'] },
  { bounds: [316, 0, 199, 194], color: '#1c9c6cf9', from: ['-13vw', '-24vh'], drift: ['-8vw', '-26vh'] },
  { bounds: [514, 215, 168, 165], color: '#158a0f', from: ['28vw', '-21vh'], drift: ['26vw', '-16vh'] },
  { bounds: [463, 469, 271, 265], color: '#133320', from: ['29vw', '24vh'], drift: ['25vw', '27vh'] },
  { bounds: [200, 601, 149, 145], color: '#1d5f34', from: ['-22vw', '25vh'], drift: ['-17vw', '22vh'] },
]

export default function BrandIntro() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (introSeen || motion.matches) return

    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return
    } catch {
      // The in-memory flag also works with browser storage disabled.
    }

    let cancelled = false
    let timeout
    function dismiss() {
      cancelled = true
      setVisible(false)
    }

    window.addEventListener('pointerdown', dismiss, { once: true })
    window.addEventListener('keydown', dismiss, { once: true })
    motion.addEventListener('change', dismiss)

    const logo = new Image()
    logo.src = LOGO
    logo.decode().then(() => {
      if (cancelled || motion.matches) return
      introSeen = true
      try {
        sessionStorage.setItem(STORAGE_KEY, '1')
      } catch {
        // The in-memory flag remains set.
      }
      setVisible(true)
      timeout = window.setTimeout(dismiss, INTRO_DURATION_MS + 250)
    }, () => {})

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', dismiss)
      motion.removeEventListener('change', dismiss)
    }
  }, [])

  if (!visible) return null

  return createPortal(
    <div
      className="brand-intro"
      style={{ '--brand-intro-duration': `${INTRO_DURATION_MS}ms` }}
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setVisible(false)
      }}
    >
      <div className="brand-intro-lockup">
        {circles.map(({ bounds: [x, y, width, height], color, from, drift }, index) => (
          <span
            key={color}
            className="brand-intro-circle"
            style={{
              left: `${(x / LOGO_WIDTH) * 100}%`,
              top: `${(y / LOGO_HEIGHT) * 100}%`,
              width: `${(width / LOGO_WIDTH) * 100}%`,
              height: `${(height / LOGO_HEIGHT) * 100}%`,
              backgroundColor: color,
              '--from-x': from[0],
              '--from-y': from[1],
              '--drift-x': drift[0],
              '--drift-y': drift[1],
              '--delay': `${index * 50}ms`,
            }}
          />
        ))}
        <img className="brand-intro-logo" src={LOGO} alt="" width={LOGO_WIDTH} height={LOGO_HEIGHT} />
      </div>
    </div>,
    document.body,
  )
}
