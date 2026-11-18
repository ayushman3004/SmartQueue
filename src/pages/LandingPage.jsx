import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, Clock, ClipboardList, Users } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useSeo } from '../utils/useSeo'
import WebsiteTour from '../components/WebsiteTour'
import './LandingPage.css'
import HowServeQWorks from '../components/HowServeQWorks'
import LandingTrust from '../components/LandingTrust'

const WAITING_PROBLEMS = [
  { title: '“How much longer will it take?”', problem: 'You arrive without knowing how many people are ahead. A quick visit becomes an uncertain wait.', solutionTitle: 'Know where you stand.', solution: 'Check the live queue and estimated wait on your phone. See your progress as staff serve customers.', Icon: Clock },
  { title: 'Your day stops in the waiting room.', problem: 'You stay nearby just to protect your place, with little time for anything else.', solutionTitle: 'Keep your place. Keep your freedom.', solution: 'Join a clinic or salon queue online and wait somewhere comfortable. Stay close enough to return when called.', Icon: Users },
  { title: 'Staff spend time managing the line.', problem: 'Handwritten lists and repeated “am I next?” questions make it harder to focus on the service.', solutionTitle: 'One clear queue for everyone.', solution: 'Staff view waiting customers, call the next token, and mark visits complete from one dashboard. Customers follow their own queue status.', Icon: ClipboardList },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [tourTrigger, setTourTrigger] = useState(0)

  useSeo({
    title: 'Live Virtual Queue Management & Online Waiting',
    description: 'Join virtual queues on your phone, track real-time counter updates, and walk straight in when your turn arrives at salons, clinics, and service venues.',
    robots: 'index, follow',
    canonical: 'https://www.serveq.tech',
  })

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    if (mobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  return (
    <div className="landing-page min-h-screen app-background-glow text-zinc-900 selection:bg-emerald-500/20 selection:text-emerald-900 relative">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 bg-[#fafaf9]/85 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline group" aria-label="serveQ Homepage">
            <img src="/serveq-logo.png" alt="serveQ Logo" className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105" />
          </Link>

          <nav id="tour-header-nav" className="hidden md:flex items-center gap-6 text-xs font-semibold text-zinc-600">
            <a href="#how-it-works" className="hover:text-zinc-950 transition-colors">How It Works</a>
            <a href="#problem-solution" className="hover:text-zinc-950 transition-colors">Why serveQ</a>
            <a href="#security" className="hover:text-zinc-950 transition-colors">Trust</a>
            <button
              type="button"
              onClick={() => setTourTrigger((c) => c + 1)}
              className="hover:text-teal-700 transition-colors flex items-center gap-1 text-teal-800 bg-teal-50 hover:bg-teal-100/80 px-2.5 py-1 rounded-full border border-teal-200/70 font-bold cursor-pointer"
            >
              <span>✨ Take Tour</span>
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <Link
              to="/business"
              className="hidden sm:inline-flex text-xs font-bold text-zinc-700 hover:text-zinc-950 px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              For Business
            </Link>
            <Link
              to="/login"
              className="hidden min-[420px]:inline-flex text-xs font-bold text-zinc-800 hover:text-zinc-950 px-2.5 sm:px-3.5 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Sign In
            </Link>
            <button
              onClick={() => navigate('/login')}
              id="tour-join-queue-btn"
              className="text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-sm hover:shadow transition-all active:scale-95"
            >
              Get Started
            </button>

            {/* Mobile Hamburger Toggle Button */}
            <button
              id="tour-mobile-nav-btn"
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden relative w-9 h-9 rounded-full bg-white text-zinc-800 border border-zinc-200/80 flex items-center justify-center active:scale-95 ml-1 cursor-pointer"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <div className="w-4 h-3.5 flex flex-col justify-between items-center">
                <span className={`w-full h-0.5 bg-zinc-800 rounded-full transition-transform duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-[6px]' : ''}`} />
                <span className={`w-full h-0.5 bg-zinc-800 rounded-full transition-opacity duration-200 ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
                <span className={`w-full h-0.5 bg-zinc-800 rounded-full transition-transform duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-[6px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Responsive Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden border-t border-zinc-200/80 bg-white/95 backdrop-blur-md px-4 py-4 space-y-2 shadow-lg"
            >
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#problem-solution"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                Why serveQ
              </a>
              <a href="#security" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors">Security & Trust</a>
              <div className="pt-2 border-t border-zinc-100 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setTourTrigger((c) => c + 1)
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200/60 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✨ Take 5-Step Tour</span>
                </button>
                <Link
                  to="/business"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200/60"
                >
                  For Business (Hub Owner Portal)
                </Link>
                <Link
                  to="/customers"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-bold text-zinc-800 hover:bg-zinc-100"
                >
                  Join a Virtual Queue
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Full-screen statement; navigation stays in the header. */}
      <section className="landing-hero" aria-labelledby="landing-headline">
        <h1 id="landing-headline">
          <span id="tour-welcome-hero" className="landing-headline-line"><span>Wait from anywhere.</span></span>
          <span className="landing-headline-line"><span>Not in line.</span></span>
        </h1>
      </section>

      <section id="problem-solution" className="waiting-comparison" aria-labelledby="waiting-comparison-title">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <header className="waiting-comparison-heading"><p>THE PROBLEM & THE SOLUTION</p><h2 id="waiting-comparison-title">Waiting shouldn’t take over your day.</h2><p>Less uncertainty for customers. A more organized day for the people serving them.</p></header>
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
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 bg-teal-950/80 px-3 py-1 rounded-full border border-teal-800">
                Start Today
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
                Ready to skip the wait?
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Join a live queue in seconds as a customer, or set up automated virtual queuing for your venue with zero setup fees.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => navigate('/customers')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all text-center cursor-pointer"
              >
                Get Started
              </button>
              <button
                type="button"
                onClick={() => navigate('/business')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider border border-zinc-700 active:scale-95 transition-all text-center cursor-pointer"
              >
                For Business
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5-Step Interactive Website Tour */}
      <WebsiteTour manualTrigger={tourTrigger} />
    </div>
  )
}
