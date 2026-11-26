import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, ClipboardList, Clock3, Compass, MapPin, Ticket, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDialog } from '../hooks/useDialog'
import './WebsiteTour.css'

const TOUR_STORAGE_KEY = 'serveq_tour_completed'
const TOUR_PROMPT_KEY = 'serveq_tour_prompt_dismissed'

const steps = [
  {
    title: 'Find a clinic near you',
    description: 'Choose your city or use your current location. In Clinics, search by name or area and compare nearby options.',
    icon: MapPin,
    example: ['Clinics', 'Search by clinic name or area'],
  },
  {
    title: 'Join online or check in',
    description: 'Join a participating clinic’s live queue from your phone. If you arrive without a booking, the clinic team can check you in at the counter.',
    icon: Ticket,
    example: ['Live queue', 'Choose a service and join'],
  },
  {
    title: 'Follow your turn',
    description: 'Open My Queues to check your ticket, place in line, and estimated wait. Keep an eye on it as the clinic calls patients.',
    icon: Clock3,
    example: ['My Queues', 'Ticket · Position · Estimated wait'],
  },
  {
    title: 'Book an appointment',
    description: 'Prefer a scheduled visit? Open Appointments, choose a clinic and an available time, then confirm your booking.',
    icon: CalendarDays,
    example: ['Appointments', 'Choose a date and time'],
  },
  {
    title: 'Find your prescriptions',
    description: 'Open My Profile or History to view a saved prescription and check scheduled follow-ups. For a walk-in registered at the clinic, sign in with the same mobile number using WhatsApp where available.',
    icon: ClipboardList,
    example: ['My Profile → Prescriptions', 'View or download a saved prescription'],
  },
]

function rememberPreference(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // The tour still works if the browser restricts storage.
  }
}

export default function WebsiteTour({ manualTrigger, restoreFocus, destination = '/customers' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [showPrompt, setShowPrompt] = useState(false)
  const isLastStep = stepIndex === steps.length - 1
  const { title, description, icon: StepIcon, example } = steps[stepIndex]

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false)
    rememberPreference(TOUR_PROMPT_KEY, 'true')
  }, [])

  const startTour = useCallback(() => {
    dismissPrompt()
    setStepIndex(0)
    setIsOpen(true)
  }, [dismissPrompt])

  function closeTour() {
    setIsOpen(false)
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) restoreFocus?.()
    })
  }

  const dialog = useDialog(isOpen, closeTour)

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

  function handleStepKeys(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    if (event.key === 'ArrowRight') next()
    else back()
  }

  return (
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
        <div className="website-tour website-tour-layer app-modal-layer">
          <div className="website-tour-backdrop" onClick={closeTour} aria-hidden="true" />
          <section
            ref={dialog}
            className="website-tour-dialog app-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            tabIndex={-1}
            onKeyDown={handleStepKeys}
          >
            <header className="website-tour-heading">
              <p>Step {stepIndex + 1} of {steps.length}</p>
              <button type="button" className="website-tour-close" onClick={closeTour} aria-label="Close tour">
                <X size={19} aria-hidden="true" />
              </button>
            </header>
            <div className="website-tour-progress" aria-hidden="true">
              {steps.map(step => <span key={step.title} data-complete={steps.indexOf(step) <= stepIndex} />)}
            </div>
            <div className="website-tour-content" aria-live="polite" aria-atomic="true">
              <h2 id="tour-title">{title}</h2>
              <p>{description}</p>
              <div className="website-tour-example">
                <span className="website-tour-icon"><StepIcon size={22} aria-hidden="true" /></span>
                <div><strong>{example[0]}</strong><span>{example[1]}</span></div>
              </div>
            </div>
            <footer className="website-tour-footer">
              <button type="button" className="website-tour-secondary" disabled={stepIndex === 0} onClick={back}>
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
              {isLastStep ? (
                <Link className="website-tour-primary" to={destination} onClick={() => rememberPreference(TOUR_STORAGE_KEY, 'completed')}>
                  {destination === '/customers' ? 'Browse clinics' : 'Go to dashboard'} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : (
                <button type="button" className="website-tour-primary" onClick={next}>
                  Next <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
