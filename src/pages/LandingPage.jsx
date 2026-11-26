import { useEffect } from 'react'
import { ArrowRight, Check, Clock, ClipboardList, Users } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useSeo } from '../utils/useSeo'
import PublicNavbar from '../components/PublicNavbar'
import './LandingPage.css'
import HowServeQWorks from '../components/HowServeQWorks'
import LandingTrust from '../components/LandingTrust'

const WAITING_PROBLEMS = [
  { title: '“How much longer will it take?”', problem: 'You arrive without knowing how many people are ahead. A quick visit becomes an uncertain wait.', solutionTitle: 'Know where you stand.', solution: 'Check the live queue and estimated wait on your phone. See your progress as staff serve customers.', Icon: Clock },
  { title: 'Your day stops in the waiting room.', problem: 'You stay nearby just to protect your place, with little time for anything else.', solutionTitle: 'Keep your place. Keep your freedom.', solution: 'Join a clinic queue online and wait somewhere comfortable. Stay close enough to return when called.', Icon: Users },
  { title: 'Staff spend time managing the line.', problem: 'Handwritten lists and repeated “am I next?” questions make it harder to focus on the service.', solutionTitle: 'One clear queue for everyone.', solution: 'Staff view waiting customers, call the next token, and mark visits complete from one dashboard. Customers follow their own queue status.', Icon: ClipboardList },
]

export default function LandingPage() {
  const navigate = useNavigate()
  useSeo({
    title: 'Clinic Queues, Digital Prescriptions & Follow-up Reminders',
    description: 'Help patients spend less time waiting with live clinic queues, digital prescriptions, and automatic in-app follow-up reminders.',
    robots: 'index, follow',
    canonical: 'https://www.serveq.tech',
  })

  useEffect(() => {
    const target = window.location.hash.slice(1)
    if (target && target !== 'take-tour') document.getElementById(target)?.scrollIntoView()
  }, [])

  return (
    <div className="landing-page app-background-glow selection:bg-emerald-500/20 selection:text-emerald-900 relative">
      <PublicNavbar />

      <section className="landing-hero" aria-labelledby="landing-headline">
        <h1 id="landing-headline">
          <span id="tour-welcome-hero" className="landing-headline-line">Less waiting.</span>{' '}
          <span className="landing-headline-line">Better clinic visits.</span>
        </h1>
        <p className="landing-hero-summary">Join a live clinic queue, view your digital prescription, and receive automatic follow-up reminders in ServeQ.</p>
      </section>

      <section id="problem-solution" className="waiting-comparison" aria-labelledby="waiting-comparison-title">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <header className="waiting-comparison-heading"><p>THE PROBLEM & THE SOLUTION</p><h2 id="waiting-comparison-title">Waiting shouldn’t take over your day.</h2><p>Less uncertainty for patients and a more organized day for clinic staff.</p></header>
          <div className="waiting-comparison-columns" aria-hidden="true"><span>The problem</span><span>The serveQ solution</span></div>
          <div className="waiting-comparison-rows">
            {WAITING_PROBLEMS.map(({ title, problem, solutionTitle, solution, Icon: _Icon }) => <article key={title} className="waiting-comparison-row">
              <div className="waiting-problem"><span className="waiting-mobile-label">The problem</span><span className="waiting-comparison-icon" aria-hidden="true"><_Icon size={21} strokeWidth={1.5} /></span><div><h3>{title}</h3><p>{problem}</p></div></div>
              <span className="waiting-comparison-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
              <div className="waiting-solution"><span className="waiting-mobile-label">The serveQ solution</span><span className="waiting-comparison-icon" aria-hidden="true"><Check size={21} strokeWidth={1.5} /></span><div><h3>{solutionTitle}</h3><p>{solution}</p></div></div>
            </article>)}
          </div>
          <div className="waiting-comparison-bottom"><p>Wait estimates can change as services progress. Keep checking your queue before heading back.</p><Link to="/customers">Try a better way to wait <ArrowRight size={16} /></Link></div>
        </div>
      </section>

      <HowServeQWorks />
      <LandingTrust />

      {/* ── Call To Action Banner ── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div id="tour-cta-banner" className="bg-zinc-950 text-white rounded-3xl p-6 sm:p-10 md:p-14 text-center sm:text-left flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
            <div className="space-y-3 max-w-xl">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
                Ready to skip the wait?
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                See your place in the clinic queue, get your prescription online, and receive automatic follow-up reminders in ServeQ.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto md:shrink-0">
              <button
                type="button"
                onClick={() => navigate('/customers')}
                className="w-full sm:w-auto min-h-11 px-6 py-3.5 rounded-full bg-teal-500 hover:bg-teal-400 text-zinc-950 text-sm font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all text-center cursor-pointer"
              >
                Get started
              </button>
              <button
                type="button"
                onClick={() => navigate('/business')}
                className="w-full sm:w-auto min-h-11 px-6 py-3.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold uppercase tracking-wider border border-zinc-700 active:scale-95 transition-all text-center cursor-pointer"
              >
                For clinics
              </button>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
