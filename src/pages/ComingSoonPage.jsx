import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useSeo } from '../utils/useSeo'
import api from '../api/axios'
import './ComingSoon.css'

const DEFAULT_NOTE = 'No spam. Just launch updates.'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function ComingSoonPage() {
  useSeo({
    title: 'Coming Soon',
    description: 'Something better is coming. Join serveQ to be among the first to hear about our launch.',
  })

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [btnLabel, setBtnLabel] = useState('Notify Me')
  const [isInvalid, setIsInvalid] = useState(false)
  const [noteState, setNoteState] = useState({ text: DEFAULT_NOTE, kind: '' })

  const cardRef = useRef(null)
  const inputRef = useRef(null)

  // 1. Keeps desktop layout on every screen: below 1024px wide scales down to fit.
  useEffect(() => {
    const DESIGN_W = 1024
    const root = document.documentElement

    const fit = () => {
      const w = window.innerWidth
      const hgt = window.innerHeight
      const z = w < DESIGN_W ? w / DESIGN_W : 1
      root.style.zoom = z === 1 ? '' : String(z)
      root.style.setProperty('--vw', w / z / 100 + 'px')
      root.style.setProperty('--vh', hgt / z / 100 + 'px')
    }

    fit()
    window.addEventListener('resize', fit)
    window.addEventListener('orientationchange', fit)

    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('orientationchange', fit)
      root.style.zoom = ''
      root.style.removeProperty('--vw')
      root.style.removeProperty('--vh')
    }
  }, [])

  // 2. Liquid glass refraction detection & interactive pointer lighting on the card
  useEffect(() => {
    const ua = navigator.userAgent || ''
    const isChromium = /Chrome|Chromium|CriOS|Edg\//.test(ua) && !/Firefox/.test(ua)
    if (isChromium) {
      document.documentElement.classList.add('has-refract')
    }

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
    const card = cardRef.current
    if (!card || reduce || coarse) return

    let raf = 0
    let px = 0
    let py = 0

    const handlePointerMove = (e) => {
      px = e.clientX
      py = e.clientY
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (!card) return
        const r = card.getBoundingClientRect()
        card.style.setProperty('--mx', px - r.left + 'px')
        card.style.setProperty('--my', py - r.top + 'px')
      })
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      if (isChromium) {
        document.documentElement.classList.remove('has-refract')
      }
    }
  }, [])

  const handleInputChange = (e) => {
    setEmail(e.target.value)
    if (isInvalid) {
      setIsInvalid(false)
      setNoteState({ text: DEFAULT_NOTE, kind: '' })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const cleanEmail = email.trim()

    if (!cleanEmail) {
      setIsInvalid(true)
      setNoteState({ text: 'Enter your email address to get launch updates.', kind: 'error' })
      inputRef.current?.focus()
      return
    }

    if (!EMAIL_RE.test(cleanEmail)) {
      setIsInvalid(true)
      setNoteState({ text: 'That email address looks incomplete. Check it and try again.', kind: 'error' })
      inputRef.current?.focus()
      return
    }

    setIsInvalid(false)

    setSubmitting(true)
    setBtnLabel('Sending…')
    setNoteState({ text: 'Securing your early access spot…', kind: '' })

    try {
      const res = await api.post('/waitlist', { email: cleanEmail })
      const message =
        res.data?.message || "You're on the list! We've sent a launch confirmation email to your inbox."

      setEmail('')
      setSubmitted(true)
      setBtnLabel('Done')
      setNoteState({ text: message, kind: 'ok' })
    } catch (err) {
      setSubmitting(false)
      setBtnLabel('Notify Me')
      const errorMessage =
        err.response?.data?.error ||
        'Something went wrong and your email was not saved. Please try again.'
      setNoteState({
        text: errorMessage,
        kind: 'error',
      })
    }
  }

  return (
    <div className="cs-page">
      {/* Live Pastel Aurora Background */}
      <div className="bg" aria-hidden="true">
        <div className="orb orb--1" />
        <div className="orb orb--2" />
        <div className="orb orb--3" />
      </div>

      {/* SVG Liquid Glass Refraction Filter */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <filter id="lg-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.016" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="3" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      {/* Transparent Header */}
      <header className="header">
        <Link to="/" className="logo" aria-label="serveQ home">
          <svg viewBox="0 0 138 77" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="serveQ">
            <path
              d="M45 7C58.8071 7 70 18.1929 70 32V52C70 65.8071 58.8071 77 45 77H25C11.1929 77 0 65.8071 0 52V32C0 18.1929 11.1929 7 25 7H45ZM35 24C25.0589 24 17 32.0589 17 42C17 51.9411 25.0589 60 35 60C44.9411 60 53 51.9411 53 42C53 32.0589 44.9411 24 35 24Z"
              fill="currentColor"
            />
            <path
              d="M94.6591 52.0909H101.42L107.088 59.5483L108.58 61.5369L117.031 72.7727H110.27L104.702 65.3153L103.31 63.4261L94.6591 52.0909ZM119.119 42.5455C119.119 47.9148 118.15 52.5549 116.211 56.4659C114.272 60.3769 111.612 63.393 108.232 65.5142C104.851 67.6354 100.99 68.696 96.6477 68.696C92.3059 68.696 88.4446 67.6354 85.0639 65.5142C81.6832 63.393 79.0234 60.3769 77.0845 56.4659C75.1456 52.5549 74.1761 47.9148 74.1761 42.5455C74.1761 37.1761 75.1456 32.536 77.0845 28.625C79.0234 24.714 81.6832 21.6979 85.0639 19.5767C88.4446 17.4555 92.3059 16.3949 96.6477 16.3949C100.99 16.3949 104.851 17.4555 108.232 19.5767C111.612 21.6979 114.272 24.714 116.211 28.625C118.15 32.536 119.119 37.1761 119.119 42.5455ZM113.153 42.5455C113.153 38.1373 112.416 34.4169 110.941 31.3842C109.483 28.3516 107.502 26.0563 105 24.4986C102.514 22.9408 99.7301 22.1619 96.6477 22.1619C93.5653 22.1619 90.773 22.9408 88.2706 24.4986C85.7848 26.0563 83.8045 28.3516 82.3295 31.3842C80.8712 34.4169 80.142 38.1373 80.142 42.5455C80.142 46.9536 80.8712 50.674 82.3295 53.7067C83.8045 56.7393 85.7848 59.0346 88.2706 60.5923C90.773 62.1501 93.5653 62.929 96.6477 62.929C99.7301 62.929 102.514 62.1501 105 60.5923C107.502 59.0346 109.483 56.7393 110.941 53.7067C112.416 50.674 113.153 46.9536 113.153 42.5455Z"
              fill="currentColor"
            />
            <ellipse cx="97" cy="42" rx="19" ry="21" fill="currentColor" />
          </svg>
        </Link>
        <div className="pill">
          <i />
          Launching Soon
        </div>
      </header>

      {/* Main Glass Card Area */}
      <main className="main">
        <section className="card" ref={cardRef} aria-labelledby="headline">
          <p className="eyebrow">Introducing serveQ</p>
          <h1 id="headline">Something Better Is Coming.</h1>
          <p className="lede">A smarter way to connect with the services you need is coming.</p>
          <p className="cta">Be the first to know when we launch.</p>
          <form id="signup" onSubmit={handleSubmit} noValidate>
            <div className="row">
              <label className="sr" htmlFor="email">
                Email address
              </label>
              <input
                ref={inputRef}
                className="field"
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                enterKeyHint="send"
                placeholder="Enter your email address"
                value={email}
                onChange={handleInputChange}
                aria-invalid={isInvalid ? 'true' : undefined}
                disabled={submitted}
                required
              />
              <button className="btn" id="submit" type="submit" disabled={submitting || submitted}>
                <span className="btn__label">{btnLabel}</span>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M3 8h9.5M8.5 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p className={`note${noteState.kind ? ' is-' + noteState.kind : ''}`} id="note" role="status" aria-live="polite">
              {noteState.text}
            </p>
          </form>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__brand">serveQ</div>
          <p className="footer__tag">A Better Way to Get Things Done.</p>
          <p className="footer__copy">© 2026 serveQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
