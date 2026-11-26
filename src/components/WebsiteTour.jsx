import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, ClipboardList, Clock3, Compass, MapPin, Ticket, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { placeTourGuide } from '../utils/tourPlacement'
import './WebsiteTour.css'

const TOUR_STORAGE_KEY = 'serveq_tour_completed'
const TOUR_PROMPT_KEY = 'serveq_tour_prompt_dismissed'

const steps = [
  {
    title: 'Find a clinic near you',
    description: 'Set your location, then search by clinic name or neighborhood to see options near you.',
    icon: MapPin,
    feature: 'Clinics',
    preview: 'Search for a clinic or neighborhood',
    target: 'find-clinic',
  },
  {
    title: 'Join a live queue',
    description: 'Pick a clinic and a service to take a ticket from your phone. Already at the clinic? Ask the team to check you in.',
    icon: Ticket,
    feature: 'Clinics',
    preview: 'Choose a service and join the queue',
    target: 'queue-pass',
    journeyStep: 0,
  },
  {
    title: 'See when it’s your turn',
    description: 'Check your position and estimated wait as the clinic calls patients.',
    icon: Clock3,
    feature: 'My Queues',
    preview: 'Ticket, position, and estimated wait',
    target: 'queue-stats',
    journeyStep: 1,
  },
  {
    title: 'Book an appointment',
    description: 'Choose a clinic and an available time for your visit, then confirm the booking.',
    icon: CalendarDays,
    feature: 'Appointments',
    preview: 'Choose a date and time',
    target: 'visit-options',
    journeyStep: 0,
  },
  {
    title: 'Find your prescriptions',
    description: 'After a visit, view or download a saved prescription in your profile or visit history.',
    icon: ClipboardList,
    feature: 'My Profile',
    preview: 'Open Prescriptions',
    target: 'visit-history',
    journeyStep: 2,
  },
]

function rememberPreference(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // The tour still works if the browser restricts storage.
  }
}

export default function WebsiteTour({ manualTrigger, restoreFocus, onJourneyStep, destination = '/customers' }) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [showPrompt, setShowPrompt] = useState(false)
  const [layout, setLayout] = useState(null)
  const dialog = useRef(null)
  const card = useRef(null)
  const completed = useRef(false)
  const isLastStep = stepIndex === steps.length - 1
  const { title, description, icon: StepIcon, feature, preview, target, journeyStep = null } = steps[stepIndex]

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false)
    rememberPreference(TOUR_PROMPT_KEY, 'true')
  }, [])

  const startTour = useCallback(() => {
    dismissPrompt()
    completed.current = false
    setLayout(null)
    setStepIndex(0)
    setIsOpen(true)
  }, [dismissPrompt])

  function closeTour() {
    setIsOpen(false)
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) restoreFocus?.()
    })
  }

  useLayoutEffect(() => {
    if (!isOpen) return
    const element = dialog.current
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    const startX = window.scrollX
    const startY = window.scrollY
    root.style.overflow = 'hidden'
    element.showModal()
    return () => {
      element.close()
      root.style.overflow = previousOverflow
      if (!completed.current) window.scrollTo({ left: startX, top: startY, behavior: 'instant' })
      onJourneyStep?.(null)
    }
  }, [isOpen, onJourneyStep])

  useLayoutEffect(() => {
    if (isOpen) onJourneyStep?.(journeyStep)
  }, [isOpen, journeyStep, onJourneyStep])

  useEffect(() => {
    if (!isOpen) return
    let frame
    let observer
    function measure() {
      const anchor = document.querySelector(`[data-tour-target="${target}"]`)
      const overlay = dialog.current
      const panel = card.current
      if (!overlay || !panel) return
      const placement = placeTourGuide(anchor?.getBoundingClientRect(), {
        width: panel.offsetWidth,
        height: panel.offsetHeight,
      }, { width: overlay.clientWidth, height: overlay.clientHeight })
      setLayout({ ...placement, target })
    }
    function queueMeasure() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    frame = requestAnimationFrame(() => {
      const anchor = document.querySelector(`[data-tour-target="${target}"]`)
      if (anchor) {
        const rect = anchor.getBoundingClientRect()
        const viewport = dialog.current.clientHeight
        const top = viewport < 760 || dialog.current.clientWidth < 640
          ? 92
          : Math.max(92, (viewport - rect.height) / 2)
        if (rect.top < 82 || rect.bottom > viewport - 16 || dialog.current.clientWidth < 640) {
          window.scrollBy({ top: rect.top - top, behavior: 'instant' })
        }
      }
      measure()
      observer = new ResizeObserver(queueMeasure)
      if (anchor) observer.observe(anchor)
      if (card.current) observer.observe(card.current)
    })
    window.addEventListener('resize', queueMeasure)
    window.addEventListener('scroll', queueMeasure, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', queueMeasure)
      window.removeEventListener('scroll', queueMeasure)
    }
  }, [isOpen, target])

  useEffect(() => {
    if (manualTrigger) return
    try {
      if (localStorage.getItem(TOUR_STORAGE_KEY) || localStorage.getItem(TOUR_PROMPT_KEY)) return
      const timer = setTimeout(() => setShowPrompt(true), 1200)
      return () => clearTimeout(timer)
    } catch {
      // The navigation still offers the tour without browser storage.
    }
  }, [manualTrigger])

  useEffect(() => {
    if (!manualTrigger) return
    const timer = setTimeout(startTour, 0)
    return () => clearTimeout(timer)
  }, [manualTrigger, startTour])

  const next = () => setStepIndex(index => Math.min(index + 1, steps.length - 1))
  const back = () => setStepIndex(index => Math.max(index - 1, 0))

  function advance() {
    if (!isLastStep) return next()
    rememberPreference(TOUR_STORAGE_KEY, 'completed')
    completed.current = true
    setIsOpen(false)
    navigate(destination)
  }

  function handleStepKeys(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    if (event.key === 'ArrowRight') next()
    else back()
  }

  if (!isOpen && !showPrompt) return null
  const currentLayout = layout?.target === target ? layout : null

  return createPortal(
    <>
      {showPrompt && !isOpen && (
        <aside className="website-tour website-tour-prompt" aria-labelledby="tour-prompt-title">
          <span className="website-tour-icon"><Compass size={21} aria-hidden="true" /></span>
          <div className="website-tour-prompt-copy">
            <h2 id="tour-prompt-title">New to ServeQ?</h2>
            <p>Find clinics, join queues, and manage your visits in five quick steps.</p>
            <div className="website-tour-actions">
              <button type="button" className="website-tour-primary" onClick={startTour}>
                Take the tour <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button type="button" className="website-tour-secondary" onClick={() => { dismissPrompt(); restoreFocus?.() }}>
                Not now
              </button>
            </div>
          </div>
          <button type="button" className="website-tour-close" onClick={() => { dismissPrompt(); restoreFocus?.() }} aria-label="Dismiss tour prompt">
            <X size={18} aria-hidden="true" />
          </button>
        </aside>
      )}

      {isOpen && (
        <dialog
          ref={dialog}
          className="website-tour website-tour-layer"
          aria-labelledby="tour-title"
          aria-describedby="tour-description"
          onCancel={event => { event.preventDefault(); closeTour() }}
          onKeyDown={handleStepKeys}
        >
          <div className="website-tour-backdrop" data-spotlight={Boolean(currentLayout?.spotlight)} onClick={closeTour} aria-hidden="true" />
          {currentLayout?.spotlight && (
            <div className="website-tour-spotlight" style={currentLayout.spotlight} aria-hidden="true" />
          )}
          <section
            ref={card}
            className="website-tour-dialog"
            data-positioned={Boolean(currentLayout)}
            style={currentLayout?.guide}
          >
            <header className="website-tour-heading">
              <span className="website-tour-kicker"><Compass size={17} aria-hidden="true" /> ServeQ tour</span>
              <button type="button" className="website-tour-close" onClick={closeTour} aria-label="Close tour">
                <X size={19} aria-hidden="true" />
              </button>
            </header>
            <div className="website-tour-progress" aria-hidden="true">
              {steps.map((step, index) => <span key={step.title} data-state={index === stepIndex ? 'current' : index < stepIndex ? 'done' : 'upcoming'} />)}
            </div>
            <div className="website-tour-content" aria-live="polite" aria-atomic="true">
              <h2 id="tour-title">{title}</h2>
              <p id="tour-description">{description}</p>
              <div className="website-tour-preview">
                <span className="website-tour-icon"><StepIcon size={20} aria-hidden="true" /></span>
                <div>
                  <span className="website-tour-feature-label">Find it in <ChevronRight size={12} aria-hidden="true" /> {feature}</span>
                  <strong>{preview}</strong>
                </div>
              </div>
            </div>
            <footer className="website-tour-footer">
              <button type="button" className="website-tour-secondary" disabled={stepIndex === 0} onClick={back}>
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
              <span className="website-tour-step">Step {stepIndex + 1} of {steps.length}</span>
              <button type="button" className="website-tour-primary" onClick={advance}>
                {isLastStep ? (destination === '/customers' ? 'Browse clinics' : 'Go to dashboard') : 'Next'}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </footer>
          </section>
        </dialog>
      )}
    </>,
    document.body,
  )
}
