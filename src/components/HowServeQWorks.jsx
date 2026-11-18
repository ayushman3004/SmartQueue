import { useId, useRef, useState } from 'react'
import { ArrowRight, Bell, CheckCircle2, Clock, MapPin, Ticket, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import './HowServeQWorks.css'

const CUSTOMER_STEPS = [
  { id: 'join', tab: 'Join a queue', number: '01', title: 'Your place.\nWithout the line.', summary: 'Get in line from your phone.', description: 'Choose a clinic or salon near you, select your service, and tap “Join Live Queue”. Your digital token keeps your place while staff see your entry on their dashboard.', action: 'Find a clinic or salon', note: 'Your token is your reference number. It does not mean that many people are ahead of you.' },
  { id: 'track', tab: 'Track your turn', number: '02', title: 'Less guessing.\nMore living.', summary: 'Wait somewhere comfortable nearby.', description: 'Open “My Queues” to see how many people are ahead and your estimated wait. Your progress updates as staff serve customers, so you can plan when to head back.', action: 'Explore live queues', note: 'Wait times are estimates and may change. Allow enough time to travel back to the business.' },
  { id: 'arrive', tab: 'Get served', number: '03', title: 'Your turn.\nCome on in.', summary: 'Head in when your token is called.', description: 'Check your queue status and turn alerts, where enabled. Show your token to the staff when you arrive. They’ll guide you to your service and mark your visit complete afterward.', action: 'Get started', note: 'Keep checking your queue screen. Notification delivery depends on your settings and the business.' },
]

const BUSINESS_STEPS = [
  { id: 'setup', tab: 'Set up', number: '01', title: 'Your services.\nYour team.', summary: 'Prepare your business before opening the queue.', description: 'Create your business profile, add services and prices, and list your doctors or stylists. Set opening hours and appointment availability, then complete onboarding to launch.', action: 'Set up your business', note: 'Business setup requires a verified email and an active plan.' },
  { id: 'manage', tab: 'Manage queues', number: '02', title: 'One queue.\nA clearer day.', summary: 'Keep walk-ins and appointments organized.', description: 'View waiting customers and upcoming bookings in your dashboard. Call the next token, update service progress, and mark visits complete so customers can follow their turn.', action: 'Explore the business portal', note: 'Keep queue statuses current so the information customers see stays useful.' },
  { id: 'monitor', tab: 'Monitor your day', number: '03', title: 'See the flow.\nPlan ahead.', summary: 'Understand what is happening at your venue.', description: 'Review your queue, appointment history, and business analytics. See service activity and staff availability, with additional AI insights available on Pro.', action: 'Explore the business portal', note: 'Available insights depend on your plan and the activity recorded at your venue.' },
]

function BusinessExample({ step }) {
  return <figure className="journey-ticket-example">
    <div className="journey-demo">
      <div className="journey-ticket-header"><div className="journey-demo-top"><span><Ticket size={16} />serveQ · Business</span><span className="journey-demo-example">Example</span></div><div className="journey-demo-venue"><strong>{step === 'setup' ? 'Ready for your first customer.' : step === 'manage' ? 'Today’s queue, in one place.' : 'A clearer view of your day.'}</strong></div></div>
      <div className="journey-business-demo">
        {step === 'setup' ? <><p className="journey-business-label">YOUR SETUP CHECKLIST</p>{['Business profile added', 'Services and prices listed', 'Staff and opening hours set'].map((item) => <div key={item} className="journey-business-row"><CheckCircle2 size={17} /><span>{item}</span></div>)}<p className="journey-business-hint">Complete the remaining onboarding steps to launch.</p></> : step === 'manage' ? <><p className="journey-business-label">LIVE QUEUE</p>{[['#23', 'Being served'], ['#24', 'Waiting'], ['#25', 'Waiting']].map(([token, status]) => <div key={token} className="journey-business-row"><strong>{token}</strong><span>{status}</span></div>)}<p className="journey-business-hint">Staff update each visit as service progresses.</p></> : <><p className="journey-business-label">OPERATIONS OVERVIEW</p>{[['Queue activity', 'Follow today’s progress'], ['Appointments', 'Review booked visits'], ['Staff availability', 'See who is on duty']].map(([title, detail]) => <div key={title} className="journey-business-row"><div><strong>{title}</strong><p>{detail}</p></div></div>)}</>}
      </div>
    </div><figcaption className="journey-demo-caption">Illustration only · Your dashboard reflects your business activity.</figcaption>
  </figure>
}

function QueueExample({ step }) {
  const ready = step === 'arrive'
  const tracking = step === 'track'
  const progress = ready ? 2 : tracking ? 1 : 0
  return <figure className="journey-ticket-example" aria-label="Illustrative salon queue example">
    <div className="journey-demo" data-ready={ready}>
      <div className="journey-ticket-header">
        <div className="journey-demo-top"><span><Ticket size={16} strokeWidth={1.5} />serveQ</span><span className="journey-demo-example">Sample pass</span></div>
        <div className="journey-demo-venue"><div><strong>Your chosen salon</strong><p><MapPin size={12} />Haircut · Live queue</p></div><span className="journey-ticket-seal" aria-hidden="true"><Ticket size={25} strokeWidth={1.2} /></span></div>
      </div>
      <div className="journey-ticket-main">
        <div className="journey-token"><span>YOUR TOKEN</span><strong><span>#</span>24</strong></div>
        <div className="journey-ticket-status">{ready ? <CheckCircle2 size={29} strokeWidth={1.4} /> : <Clock size={26} strokeWidth={1.4} />}<strong>{ready ? 'You’re up next.' : tracking ? 'Almost your turn.' : 'You’re in line.'}</strong><p>{ready ? 'Head in and show your token.' : tracking ? 'Stay close. It won’t be long.' : 'Your place is saved.'}</p></div>
      </div>
      <div className="journey-ticket-details">
        <ol className="journey-ticket-progress" aria-label="Example queue progress">{['Joined', 'Getting closer', 'Your turn'].map((label, index) => <li key={label} data-complete={index <= progress} aria-current={index === progress ? 'step' : undefined}><span aria-hidden="true">{index < progress ? <CheckCircle2 size={13} /> : index + 1}</span><span>{label}</span></li>)}</ol>
        {ready ? <div className="journey-ready"><span>READY WHEN YOU ARE</span><strong>Show #24 to the staff <ArrowRight size={16} /></strong></div> : <dl className="journey-stats"><div><dt><Users size={13} />People ahead</dt><dd>{tracking ? '1' : '3'}<span>{tracking ? ' person' : ' people'}</span></dd></div><div><dt><Clock size={13} />Estimated wait</dt><dd>{tracking ? '~5' : '~15'}<span> min</span></dd></div></dl>}
        <div className="journey-demo-message"><Bell size={14} strokeWidth={1.5} /><p>{ready ? 'The team will guide you to your service.' : 'Follow your progress in My Queues.'}</p></div>
      </div>
    </div>
    <figcaption className="journey-demo-caption">Example only · Your queue and wait time may differ.</figcaption>
  </figure>
}

export default function HowServeQWorks() {
  const [audience, setAudience] = useState('customers')
  const [selected, setSelected] = useState(0)
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
      <header className="journey-heading"><p className="journey-eyebrow">FOR BOTH SIDES OF THE COUNTER</p><h2 id={`${id}-title`}>How ServeQ works</h2></header>
      <div className="journey-audiences" role="tablist" aria-label="Choose your journey">{['customers', 'businesses'].map((value, index) => <button type="button" key={value} ref={(element) => { audienceRefs.current[index] = element }} id={`${id}-audience-${value}`} role="tab" aria-selected={audience === value} aria-controls={`${id}-audience-panel-${value}`} tabIndex={audience === value ? 0 : -1} onClick={() => { setAudience(value); setSelected(0) }} onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index; setAudience(next === 0 ? 'customers' : 'businesses'); setSelected(0); audienceRefs.current[next]?.focus() } }}>For {value === 'customers' ? 'Customers' : 'Businesses'}</button>)}</div>
      {['customers', 'businesses'].map((value) => <div key={value} hidden={audience !== value} id={`${id}-audience-panel-${value}`} role="tabpanel" aria-labelledby={`${id}-audience-${value}`}>{audience === value && <>
      <div className="journey-tabs" role="tablist" aria-label="Your ServeQ journey">{STEPS.map((item, index) => <button key={item.id} type="button" role="tab" id={`${id}-tab-${index}`} aria-selected={selected === index} aria-controls={`${id}-panel-${index}`} tabIndex={selected === index ? 0 : -1} ref={(element) => { tabRefs.current[index] = element }} onClick={() => setSelected(index)} onKeyDown={(event) => handleKeyDown(event, index)}><span>{item.number}</span>{item.tab}</button>)}</div>
      {STEPS.map((item, index) => <div key={item.id} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={selected !== index} tabIndex={0} className="journey-panel" data-step={item.id}>
        {selected === index && <>
          <div className="journey-copy"><h3>{step.title.split('\n').map((line) => <span key={line}>{line}</span>)}</h3><p className="journey-summary">{step.summary}</p><p className="journey-description">{step.description}</p><Link to={audience === 'customers' ? '/customers' : '/business'} className="journey-action">{step.action}<ArrowRight size={17} /></Link><p className="journey-note">{step.note}</p></div>
          <div className="journey-visual">{audience === 'customers' ? <QueueExample step={step.id} /> : <BusinessExample step={step.id} />}</div>
        </>}
      </div>)}
      </>}</div>)}
    </div>
  </section>
}
