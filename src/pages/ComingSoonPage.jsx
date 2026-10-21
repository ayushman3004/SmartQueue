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
          <img src="/serveq-logo.png" alt="serveQ" className="h-8 w-auto object-contain" />
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
