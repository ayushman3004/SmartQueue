import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { useSeo } from '../utils/useSeo'
import WebsiteTour from '../components/WebsiteTour'

const VENUES = [
  {
    title: 'Salons & Hair Studios',
    desc: 'Seamless walk-in booking and stylist turnaround without idle waiting.',
    image: '/hubs/salon.png',
    badge: 'Salon'
  },
  {
    title: 'Medical Clinics & Doctors',
    desc: 'Stress-free waiting rooms for patients with live doctor desk calling.',
    image: '/hubs/clinic.png',
    badge: 'Clinic'
  },
  {
    title: 'Wellness & Grooming Lounges',
    desc: 'Predictable scheduling and transparent queues for premium personal care.',
    image: '/hubs/salon.png',
    badge: 'Wellness'
  },
  {
    title: 'Diagnostic & Care Centers',
    desc: 'Orderly token-based routing for consultations and medical checkups.',
    image: '/hubs/clinic.png',
    badge: 'Healthcare'
  }
]

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Zero-Latency Sync',
    desc: 'Sub-10ms WebSocket connection keeps token numbers updating in real-time across all devices.'
  },
  {
    icon: (
      <svg className="w-5 h-5 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'Predictive Wait Times',
    desc: 'Smart turnaround forecasting estimates remaining wait times based on counter velocity.'
  },
  {
    icon: (
      <svg className="w-5 h-5 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    title: 'Integrated Payments',
    desc: 'Reserve priority slots instantly with automatic escrow refunds if your schedule changes.'
  },
  {
    icon: (
      <svg className="w-5 h-5 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: 'Business Command Suite',
    desc: 'Manage customer flow, call tokens with one tap, and analyze venue traffic analytics.'
  }
]

const STEPS = [
  {
    step: '01',
    title: 'Join Virtually',
    desc: 'Find any nearby venue or scan the on-site QR code right from your smartphone.'
  },
  {
    step: '02',
    title: 'Wait Anywhere',
    desc: 'Grab coffee or relax nearby. Your live queue position and estimated wait time sync in real-time.'
  },
  {
    step: '03',
    title: 'Walk Straight In',
    desc: 'Receive an instant notification when your counter or table is ready. No crowded lines.'
  }
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [tourTrigger, setTourTrigger] = useState(0)

  useSeo({
    title: 'Live Virtual Queue Management & Online Waiting',
    description: 'Join virtual queues on your phone, track real-time counter updates, and walk straight in when your turn arrives at salons, clinics, and service venues.',
    robots: 'index, follow',
    canonical: 'https://serveq.tech',
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
    <div className="min-h-screen bg-[#fafaf9] text-zinc-900 selection:bg-teal-500/20 selection:text-teal-900">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 bg-[#fafaf9]/85 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline group" aria-label="serveQ Homepage">
            <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200/80 p-1 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <img src="/logo.png?v=2" alt="serveQ Logo" className="w-full h-full object-contain" width="36" height="36" />
            </div>
            <span className="text-lg font-black tracking-tight text-zinc-950">serve<span className="text-[#FF5537]">Q</span></span>
          </Link>

          <nav id="tour-header-nav" className="hidden md:flex items-center gap-6 text-xs font-semibold text-zinc-600">
            <a href="#how-it-works" className="hover:text-zinc-950 transition-colors">How It Works</a>
            <a href="#venues" className="hover:text-zinc-950 transition-colors">Venues</a>
            <a href="#features" className="hover:text-zinc-950 transition-colors">Features</a>
            <button
              type="button"
              onClick={() => setTourTrigger((c) => c + 1)}
              className="hover:text-teal-700 transition-colors flex items-center gap-1 text-teal-800 bg-teal-50 hover:bg-teal-100/80 px-2.5 py-1 rounded-full border border-teal-200/70 font-bold cursor-pointer"
            >
              <span>✨ Take Tour</span>
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/business"
              className="hidden sm:inline-flex text-xs font-bold text-zinc-700 hover:text-zinc-950 px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              For Business
            </Link>
            <Link
              to="/login"
              className="text-xs font-bold text-zinc-800 hover:text-zinc-950 px-3 sm:px-3.5 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Sign In
            </Link>
            <button
              onClick={() => navigate('/login')}
              className="text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white px-3.5 sm:px-4 py-2 rounded-full shadow-sm hover:shadow transition-all active:scale-95"
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
                href="#venues"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                Venues
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                Features
              </a>
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

      {/* ── Hero Section ── */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Value Prop */}
            <div id="tour-welcome-hero" className="lg:col-span-7 text-center lg:text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/70 text-teal-800 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                Live Virtual Queue Management
              </div>

              <h1 className="text-4xl sm:text-6xl font-black text-zinc-950 tracking-tight leading-[1.08]">
                Wait from anywhere, <br />
                <span className="text-teal-600">not in line.</span>
              </h1>

              <p className="text-base sm:text-lg text-zinc-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Join virtual lines on your phone, track live wait times, and walk straight in when your turn arrives. ServeQ eliminates crowded waiting rooms for salons, clinics, and service venues alike.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
                <button
                  id="tour-join-queue-btn"
                  type="button"
                  onClick={() => navigate('/customers')}
                  className="px-6 py-3.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold tracking-wide uppercase shadow-md shadow-teal-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  Join a Queue →
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/business')}
                  className="px-6 py-3.5 rounded-full bg-white hover:bg-zinc-50 border border-zinc-200/90 text-zinc-800 text-xs font-bold tracking-wide uppercase shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  Business Portal
                </button>
              </div>

              {/* Accurate Value Props */}
              <div className="pt-6 border-t border-zinc-200/80 grid grid-cols-3 gap-3 sm:flex sm:items-center sm:justify-start sm:gap-8 text-left">
                <div>
                  <p className="text-base sm:text-xl font-black text-zinc-950">Real-Time</p>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">WebSocket Sync</p>
                </div>
                <div className="hidden sm:block w-px h-8 bg-zinc-200" />
                <div>
                  <p className="text-base sm:text-xl font-black text-zinc-950">Virtual</p>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Queue Position</p>
                </div>
                <div className="hidden sm:block w-px h-8 bg-zinc-200" />
                <div>
                  <p className="text-base sm:text-xl font-black text-teal-600">Automated</p>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Token Alerts</p>
                </div>
              </div>
            </div>

            {/* Right Column: Clean Interactive Mockup */}
            <div className="lg:col-span-5 flex justify-center">
              <motion.div
                id="tour-live-pass-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-sm bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xl shadow-zinc-950/5 space-y-5 text-left"
              >
                {/* Live Pass Header */}
                <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
                    <span className="text-xs font-bold text-zinc-900 tracking-wide">Live Queue Pass</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200/70">
                    Active
                  </span>
                </div>

                {/* Venue Info */}
                <div>
                  <p className="text-xs font-medium text-zinc-500">Venue</p>
                  <h3 className="text-base font-bold text-zinc-950">Metropolitan Health Clinic</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Counter 02 • General Physician</p>
                </div>

                {/* Token Display */}
                <div className="bg-zinc-50 rounded-2xl p-5 border border-zinc-100 text-center space-y-1">
                  <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Your Token Number</p>
                  <p className="text-5xl font-black tracking-tight text-teal-600">#24</p>
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-600 pt-1">
                    <span>Now Serving:</span>
                    <span className="text-zinc-950 font-black">#22</span>
                  </div>
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-teal-50/50 rounded-xl p-3 border border-teal-100">
                    <p className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">Ahead Of You</p>
                    <p className="text-lg font-black text-teal-950 mt-0.5">2 People</p>
                  </div>
                  <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Estimated Wait</p>
                    <p className="text-lg font-black text-zinc-900 mt-0.5">~4 Mins</p>
                  </div>
                </div>

                {/* Bottom Notification Callout */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-teal-600/5 border border-teal-500/20 text-xs text-teal-900 font-medium">
                  <svg className="w-4 h-4 text-teal-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span>We'll notify you on your phone when your turn is next.</span>
                </div>
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20 bg-white border-y border-zinc-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Simple Process</span>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
              How ServeQ Works
            </h2>
            <p className="text-sm sm:text-base text-zinc-600">
              Three effortless steps to never wait in a crowded physical lobby again.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.step} className="bg-zinc-50 rounded-2xl p-7 border border-zinc-200/70 space-y-3 text-left hover:border-zinc-300 transition-colors">
                <span className="text-xs font-black text-teal-600 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200/60">
                  {s.step}
                </span>
                <h3 className="text-lg font-bold text-zinc-950 pt-1">{s.title}</h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Venues Supported ── */}
      <section id="venues" className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12 text-left">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-teal-600">High-Volume Hubs</span>
              <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mt-1">
                Built For Every Venue
              </h2>
            </div>
            <Link
              to="/business"
              className="text-xs font-bold text-teal-700 hover:text-teal-800 transition-colors"
            >
              Set up your venue →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {VENUES.map((v) => (
              <div
                key={v.title}
                className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs hover:shadow-md hover:border-zinc-300 transition-all text-left flex flex-col"
              >
                <div className="h-44 overflow-hidden bg-zinc-100 relative">
                  <img
                    src={v.image}
                    alt={v.title}
                    loading="lazy"
                    decoding="async"
                    width="400"
                    height="176"
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-wider bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-zinc-900 border border-zinc-200/70">
                    {v.badge}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h3 className="text-base font-bold text-zinc-950">{v.title}</h3>
                    <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{v.desc}</p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigate('/customers')}
                      className="text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors"
                    >
                      View Live Queues →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Core Features ── */}
      <section id="features" className="py-20 bg-white border-y border-zinc-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Platform Infrastructure</span>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
              Engineered For Reliability
            </h2>
            <p className="text-sm sm:text-base text-zinc-600">
              High-performance queuing technology built to keep venues and customers in perfect sync.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-zinc-50 rounded-2xl p-6 border border-zinc-200/70 space-y-3 text-left hover:border-zinc-300 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200/80 flex items-center justify-center text-lg shadow-xs">
                  {f.icon}
                </div>
                <h3 className="text-base font-bold text-zinc-950">{f.title}</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Call To Action Banner ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div id="tour-cta-banner" className="bg-zinc-950 text-white rounded-3xl p-8 sm:p-14 text-center sm:text-left flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
            <div className="space-y-3 max-w-xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 bg-teal-950/80 px-3 py-1 rounded-full border border-teal-800">
                Start Today
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
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

      {/* ── Simple Minimal Footer ── */}
      <footer className="border-t border-zinc-200/80 py-10 bg-white text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png?v=2" alt="serveQ Logo" className="w-5 h-5 object-contain" width="20" height="20" />
            <span className="font-bold text-zinc-900">serve<span className="text-[#FF5537]">Q</span></span>
            <span>• Smart Virtual Queuing</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => setTourTrigger((c) => c + 1)}
              className="text-teal-700 hover:text-teal-900 font-bold transition-colors cursor-pointer"
            >
              ✨ Take Tour
            </button>
            <Link to="/business" className="hover:text-zinc-900 transition-colors">Business Portal</Link>
            <Link to="/login" className="hover:text-zinc-900 transition-colors">Sign In</Link>
            <a href="#how-it-works" className="hover:text-zinc-900 transition-colors">How It Works</a>
            <Link to="/privacy" className="hover:text-zinc-900 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-zinc-900 transition-colors">Terms & Conditions</Link>
          </div>
          <p>© {new Date().getFullYear()} serveQ. All rights reserved.</p>
        </div>
      </footer>

      {/* 5-Step Interactive Website Tour */}
      <WebsiteTour manualTrigger={tourTrigger} />
    </div>
  )
}
