import { useId, useRef, useState } from 'react'
import { ArrowRight, Bell, CheckCircle2, ClipboardList, Clock, MapPin, Ticket, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import './HowServeQWorks.css'

const CUSTOMER_STEPS = [
  { id: 'join', tab: 'Book or join', title: 'Choose your visit', summary: 'Book a time, join online, or check in at the clinic.', description: 'Pick an available appointment slot or join a participating clinic’s live queue. If you arrive without a booking, the clinic team can register you at the counter.', action: 'Find a clinic', to: '/customers' },
  { id: 'track', tab: 'Track your turn', title: 'Know when to head in', summary: 'See your place in line and estimated wait.', description: 'Open My Queues to follow your visit as the clinic calls patients. When it’s your turn, show your queue pass to the clinic team.', action: 'Explore live queues', to: '/queue', note: 'Wait times are estimates. Allow enough time to travel back to the clinic.' },
  { id: 'after', tab: 'After your visit', title: 'Find your prescription', summary: 'Your visit history is in your ServeQ account.', description: 'View or download prescriptions your doctor has saved and find any scheduled follow-up reminders. If the clinic registered your walk-in, use the same mobile number to sign in with WhatsApp where available.', action: 'Sign in to ServeQ', to: '/login' },
]

const BUSINESS_STEPS = [
  { id: 'setup', tab: 'Set up', title: 'Set up your clinic', summary: 'Apply for a clinic account and choose a plan after approval.', description: 'Set your opening hours, add services and prices, then invite doctors to their own workspace.', action: 'Apply to join', to: '/business#apply' },
  { id: 'manage', tab: 'Run the clinic', title: 'Manage the day’s visits', summary: 'Keep walk-ins and booked visits organized.', description: 'Clinic staff register walk-ins and record counter payments. Doctors call their assigned patients, update consultations, and save prescriptions.', action: 'See clinic tools', to: '/business#facilities' },
  { id: 'monitor', tab: 'Use Pro tools', title: 'Plan around demand', summary: 'Use Pro to manage rooms and review activity.', description: 'Filter queues by room, move through multiple services with the assigned doctor, and review AI insights into peak hours and revenue.', action: 'Compare clinic plans', to: '/business#pricing' },
]

const EXAMPLES = {
  setup: { context: 'Clinic setup', rows: [['Services', 'List treatments and prices'], ['Doctors', 'Invite your team'], ['Schedule', 'Set hours and booking slots']] },
  manage: { context: 'Clinic dashboard', rows: [['Walk-in', 'Checked in at the counter'], ['Appointment', 'Confirmed for the selected slot'], ['Counter payment', 'UPI or cash recorded']] },
  monitor: { context: 'Pro clinic dashboard', rows: [['Room views', 'Filter the queue by consultation room'], ['Service progress', 'Move to the next service in a visit'], ['Clinic activity', 'Review peak hours and revenue']] },
  after: { context: 'Visit history', rows: [['Consultation', 'Completed'], ['Digital prescription', 'Ready to view in your account'], ['Follow-up', 'Reminder scheduled by your doctor']] },
}

function VisitExample({ step }) {
  const { context, rows } = EXAMPLES[step]
  return <figure className="journey-ticket-example">
    <div className="journey-demo">
      <div className="journey-ticket-header"><div className="journey-demo-top"><span><ClipboardList size={16} aria-hidden="true" />{context}</span><span className="journey-demo-example">Example</span></div></div>
      <div className="journey-business-demo" data-tour-target={step === 'after' ? 'visit-history' : undefined}>
        {rows.map(([title, detail]) => <div key={title} className="journey-business-row"><div><strong>{title}</strong><p>{detail}</p></div></div>)}
      </div>
    </div>
  </figure>
}

function QueueExample({ step }) {
  const tracking = step === 'track'
  const progress = tracking ? 1 : 0
  return <figure className="journey-ticket-example" aria-label="Illustrative clinic queue example">
    <div className="journey-demo">
      <div className="journey-ticket-header">
        <div className="journey-demo-top"><span><Ticket size={16} strokeWidth={1.5} />serveQ</span><span className="journey-demo-example">Sample pass</span></div>
        <div className="journey-demo-venue"><div><strong>Your chosen clinic</strong><p><MapPin size={12} />Consultation · Live queue</p></div><span className="journey-ticket-seal" aria-hidden="true"><Ticket size={25} strokeWidth={1.2} /></span></div>
      </div>
      <div className="journey-ticket-main" data-tour-target="queue-pass">
        <div className="journey-token"><span>YOUR TOKEN</span><strong><span>#</span>24</strong></div>
        <div className="journey-ticket-status"><Clock size={26} strokeWidth={1.4} /><strong>{tracking ? 'Almost your turn' : 'You’re in line'}</strong><p>{tracking ? 'Stay nearby so you can return when called.' : 'Your place is saved.'}</p></div>
      </div>
      <div className="journey-ticket-details">
        <ol className="journey-ticket-progress" aria-label="Example queue progress">{['Joined', 'Getting closer', 'Your turn'].map((label, index) => <li key={label} data-complete={index <= progress} aria-current={index === progress ? 'step' : undefined}><span aria-hidden="true">{index < progress ? <CheckCircle2 size={13} /> : index + 1}</span><span>{label}</span></li>)}</ol>
        <dl className="journey-stats" data-tour-target="queue-stats"><div><dt><Users size={13} />People ahead</dt><dd>{tracking ? '1' : '3'}<span>{tracking ? ' person' : ' people'}</span></dd></div><div><dt><Clock size={13} />Estimated wait</dt><dd>{tracking ? '~5' : '~15'}<span> min</span></dd></div></dl>
        <div className="journey-demo-message"><Bell size={14} strokeWidth={1.5} /><p>Follow your progress in My Queues.</p></div>
      </div>
    </div>
    <figcaption className="journey-demo-caption">Example only · Your queue and wait time may differ.</figcaption>
  </figure>
}

export default function HowServeQWorks({ tourStep = null }) {
  const [chosenAudience, setAudience] = useState('customers')
  const [chosenStep, setSelected] = useState(0)
  const audience = tourStep === null ? chosenAudience : 'customers'
  const selected = tourStep ?? chosenStep
  const audienceRefs = useRef([])
  const STEPS = audience === 'customers' ? CUSTOMER_STEPS : BUSINESS_STEPS
  const tabRefs = useRef([])
  const id = useId()
  const step = STEPS[selected]
  const handleKeyDown = (event, index) => {
    let next
    if (event.key === 'ArrowRight') next = (index + 1) % STEPS.length
    else if (event.key === 'ArrowLeft') next = (index + STEPS.length - 1) % STEPS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = STEPS.length - 1
    else return
    event.preventDefault()
    setSelected(next)
    tabRefs.current[next]?.focus()
  }
  return <section id="how-it-works" className="journey-section" aria-labelledby={`${id}-title`}>
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <header className="journey-heading"><h2 id={`${id}-title`}>How ServeQ works</h2></header>
      <div className="journey-audiences" role="tablist" aria-label="Choose your role">{['customers', 'businesses'].map((value, index) => <button type="button" key={value} ref={(element) => { audienceRefs.current[index] = element }} id={`${id}-audience-${value}`} role="tab" aria-selected={audience === value} aria-controls={`${id}-audience-panel-${value}`} tabIndex={audience === value ? 0 : -1} onClick={() => { setAudience(value); setSelected(0) }} onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index; setAudience(next === 0 ? 'customers' : 'businesses'); setSelected(0); audienceRefs.current[next]?.focus() } }}>{value === 'customers' ? 'For patients' : 'For clinics'}</button>)}</div>
      {['customers', 'businesses'].map((value) => <div key={value} hidden={audience !== value} id={`${id}-audience-panel-${value}`} role="tabpanel" aria-labelledby={`${id}-audience-${value}`}>{audience === value && <>
      <div className="journey-tabs" role="tablist" aria-label="Your ServeQ journey">{STEPS.map((item, index) => <button key={item.id} type="button" role="tab" id={`${id}-tab-${index}`} aria-selected={selected === index} aria-controls={`${id}-panel-${index}`} tabIndex={selected === index ? 0 : -1} ref={(element) => { tabRefs.current[index] = element }} onClick={() => setSelected(index)} onKeyDown={(event) => handleKeyDown(event, index)}>{item.tab}</button>)}</div>
      {STEPS.map((item, index) => <div key={item.id} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={selected !== index} tabIndex={0} className="journey-panel" data-step={item.id}>
        {selected === index && <>
          <div className="journey-copy" data-tour-target={step.id === 'join' ? 'visit-options' : undefined}><h3>{step.title}</h3><p className="journey-summary">{step.summary}</p><p className="journey-description">{step.description}</p><Link to={step.to} className="journey-action">{step.action}<ArrowRight size={17} aria-hidden="true" /></Link>{step.note && <p className="journey-note">{step.note}</p>}</div>
          <div className="journey-visual">{Object.hasOwn(EXAMPLES, step.id) ? <VisitExample step={step.id} /> : <QueueExample step={step.id} />}</div>
        </>}
      </div>)}
      </>}</div>)}
    </div>
  </section>
}
