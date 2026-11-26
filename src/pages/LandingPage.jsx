import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, ClipboardList, Stethoscope } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useSeo } from '../utils/useSeo'
import { homePageMetadata } from '../seo/publicPages'
import { SUBSCRIPTION_PLANS } from '../shared/subscriptionPlans'
import PublicNavbar from '../components/PublicNavbar'
import HowServeQWorks from '../components/HowServeQWorks'
import LandingTrust from '../components/LandingTrust'
import './LandingPage.css'

const WORKSPACES = [
  {
    audience: 'Patients',
    title: 'Choose how you visit',
    description: 'Book an appointment, join a live queue online, or check in at the clinic. Follow your queue position and estimated wait from your phone.',
    Icon: CalendarDays,
  },
  {
    audience: 'Clinic teams',
    title: 'Manage arrivals and counter payments',
    description: 'Register walk-ins alongside scheduled appointments, see who is waiting, and record cash or UPI QR payments at the counter.',
    Icon: ClipboardList,
  },
  {
    audience: 'Doctors',
    title: 'Manage assigned visits and follow-ups',
    description: 'Call the next assigned patient, update the visit, and save a digital prescription with a follow-up date patients can see in ServeQ.',
    Icon: Stethoscope,
  },
]

const CLINIC_PLANS = [
  {
    plan: SUBSCRIPTION_PLANS.BASIC,
    title: 'Basic',
    description: 'Appointments, walk-in check-in, live queues, counter payments, and digital prescriptions.',
  },
  {
    plan: SUBSCRIPTION_PLANS.PRO,
    title: 'Pro',
    description: 'Everything in Basic, plus room-based queue views, multi-service visits with the assigned doctor, and AI insights into peak hours and revenue.',
  },
]

export default function LandingPage() {
  const { hash } = useLocation()
  const [tourJourneyStep, setTourJourneyStep] = useState(null)
  useSeo(homePageMetadata)

  useEffect(() => {
    const target = hash.slice(1)
    if (!target || target === 'take-tour') return
    const frame = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView())
    return () => cancelAnimationFrame(frame)
  }, [hash])

  return (
    <div className="landing-page app-background-glow selection:bg-emerald-500/20 selection:text-emerald-900 relative">
      <PublicNavbar onTourJourneyStep={setTourJourneyStep} />

      <section className="landing-hero" aria-labelledby="landing-headline">
        <h1 id="landing-headline">
          <span id="tour-welcome-hero" className="landing-headline-line">Less waiting.</span>{' '}
          <span className="landing-headline-line">Better clinic visits.</span>
        </h1>
        <p className="landing-hero-summary">Book a visit or join a live queue. Track your turn and find your prescription in ServeQ.</p>
        <div className="landing-actions">
          <Link to="/customers" data-tour-target="find-clinic" className="landing-action landing-action-primary">Find a clinic <ArrowRight size={17} aria-hidden="true" /></Link>
          <Link to="/business" className="landing-action">For clinic teams</Link>
        </div>
      </section>

      <section id="problem-solution" className="landing-workspaces" aria-labelledby="landing-workspaces-title">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <header className="landing-section-heading">
            <h2 id="landing-workspaces-title">From check-in to follow-up</h2>
          </header>
          <ul className="landing-workspace-list">
            {WORKSPACES.map(({ audience, title, description, Icon: _Icon }) => (
              <li key={audience}>
                <div className="landing-workspace-role"><span><_Icon size={21} strokeWidth={1.5} aria-hidden="true" /></span>{audience}</div>
                <div><h3>{title}</h3><p>{description}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <HowServeQWorks tourStep={tourJourneyStep} />

      <section id="clinic-plans" className="landing-plans" aria-labelledby="landing-plans-title">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <header className="landing-section-heading">
            <h2 id="landing-plans-title">Plans for your clinic</h2>
          </header>
          <div className="landing-plan-grid">
            {CLINIC_PLANS.map(({ plan, title, description }) => (
              <article className="landing-plan" key={plan.id}>
                <h3>{title}</h3>
                <p className="landing-plan-price"><strong>₹{plan.price.toLocaleString('en-IN')}</strong><span> per {plan.durationDays} days</span></p>
                <p className="landing-plan-capacity">Up to {plan.maxActiveClinics} active clinics</p>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <p className="landing-plan-note">At supported clinics, patients can opt in to WhatsApp appointment reminders. Pro also supports follow-up reminders and queue-turn alerts where configured.</p>
          <Link to="/business#pricing" className="landing-action landing-action-primary">Compare clinic plans <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </section>

      <LandingTrust />

      <section id="mission-vision" aria-label="Mission and vision">
        <div className="landing-purpose-grid max-w-6xl mx-auto px-4 sm:px-6">
          <div>
            <h2>Mission</h2>
            <p>To give people back their time by reducing unnecessary waiting and making appointment booking simple and accessible. Through reliable, innovative queue management solutions, ServeQ helps service providers work efficiently, deliver better customer experiences, and create lasting value for the people and communities they serve.</p>
          </div>
          <div>
            <h2>Vision</h2>
            <p>To build a world where accessing a service fits into life—where people spend less time in queues and more time on what matters.</p>
          </div>
        </div>
      </section>

      <section>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div id="tour-cta-banner" className="landing-cta">
            <div>
              <h2>Bring ServeQ to your clinic</h2>
              <p>Apply to join. Once approved, choose a plan and set up your services, doctors, and opening hours.</p>
            </div>
            <Link to="/business#apply" className="landing-action landing-action-primary">Apply to join <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </div>
  )
}
