import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Scissors, Stethoscope, LogOut } from 'lucide-react'
import './CustomerServiceChoice.css'

export default function CustomerServiceChoice({ onChoose, onSignOut }) {
  const [opening, setOpening] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const enter = (category) => {
    if (opening) return
    setOpening(category)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    timer.current = setTimeout(() => onChoose(category), reduced ? 0 : 280)
  }

  return (
    <main className="service-choice app-background-glow">
      <header className="service-choice-header">
        <img src="/serveq-logo.png" alt="serveQ" />
        <button type="button" onClick={onSignOut}><LogOut size={16} /> Sign out</button>
      </header>
      <div className="service-choice-intro">
        <p className="service-choice-eyebrow">YOUR TIME, WELL SPENT</p>
        <h1>Which door brings you here?</h1>
        <p>Care or a little self-care. Choose where you’d like to go.</p>
      </div>
      <div className="service-doors">
        {[
          { id: 'clinic', title: 'Clinics', Icon: Stethoscope, note: 'Feel better, sooner.', detail: 'Find doctors, join live queues and book your next visit.', action: 'Explore clinics' },
          { id: 'salon', title: 'Salons', Icon: Scissors, note: 'Make time for yourself.', detail: 'Find your salon, pick a service and skip the wait.', action: 'Explore salons' },
        ].map(({ id, title, Icon: _Icon, note, detail, action }) => (
          <button key={id} type="button" className={`service-door-choice service-door-${id}`} data-opening={opening === id} disabled={Boolean(opening)} onClick={() => enter(id)} aria-label={action}>
            <span className="service-door-frame" aria-hidden="true">
              <span className="service-door-interior"><_Icon size={46} strokeWidth={1.3} /><span>Come on in.</span></span>
              <span className="service-door-panel">
                <span className="service-door-window"><_Icon size={40} strokeWidth={1.4} /></span>
                <span className="service-door-plaque">{title}</span>
                <span className="service-door-handle" />
                <span className="service-door-inset" />
              </span>
            </span>
            <span className="service-door-copy"><strong>{note}</strong><span>{detail}</span><b>{action}<ArrowRight size={17} /></b></span>
          </button>
        ))}
      </div>
      <p className="sr-only" role="status">{opening ? 'Opening your dashboard…' : ''}</p>
    </main>
  )
}
