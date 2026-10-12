import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import React from 'react'

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
    icon: '⚡',
    title: 'Zero-Latency Sync',
    desc: 'Sub-10ms WebSocket connection keeps token numbers updating in real-time across all devices.'
  },
  {
    icon: '🧠',
    title: 'Predictive Wait Times',
    desc: 'Smart turnaround forecasting estimates remaining wait times based on counter velocity.'
  },
  {
    icon: '💳',
    title: 'Integrated Payments',
    desc: 'Reserve priority slots instantly with automatic escrow refunds if your schedule changes.'
  },
  {
    icon: '🏢',
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

  return (
    <div className="min-h-screen bg-[#fafaf9] text-zinc-900 selection:bg-teal-500/20 selection:text-teal-900">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 bg-[#fafaf9]/85 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200/80 p-1 flex items-center justify-center shadow-xs">
              <img src="/logo.png" alt="serveQ Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg font-black tracking-tight text-zinc-950">serveQ</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-zinc-600">
            <a href="#how-it-works" className="hover:text-zinc-950 transition-colors">How It Works</a>
            <a href="#venues" className="hover:text-zinc-950 transition-colors">Venues</a>
            <a href="#features" className="hover:text-zinc-950 transition-colors">Features</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/business"
              className="hidden sm:inline-flex text-xs font-bold text-zinc-700 hover:text-zinc-950 px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              For Business
            </Link>
            <Link
              to="/login"
              className="text-xs font-bold text-zinc-800 hover:text-zinc-950 px-3.5 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Sign In
            </Link>
            <button
              onClick={() => navigate('/login')}
              className="text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-full shadow-sm hover:shadow transition-all active:scale-95"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Value Prop */}
            <div className="lg:col-span-7 text-center lg:text-left space-y-6">
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
                  type="button"
                  onClick={() => navigate('/customers')}
                  className="px-6 py-3.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold tracking-wide uppercase shadow-md shadow-teal-600/20 active:scale-95 transition-all"
                >
                  Join a Queue →
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/business')}
                  className="px-6 py-3.5 rounded-full bg-white hover:bg-zinc-50 border border-zinc-200/90 text-zinc-800 text-xs font-bold tracking-wide uppercase shadow-xs active:scale-95 transition-all"
                >
                  Business Portal
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="pt-6 border-t border-zinc-200/80 flex items-center justify-center lg:justify-start gap-8 text-left">
                <div>
                  <p className="text-xl font-black text-zinc-950">&lt; 10ms</p>
                  <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Sync Latency</p>
                </div>
                <div className="w-px h-8 bg-zinc-200" />
                <div>
                  <p className="text-xl font-black text-zinc-950">100%</p>
                  <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Virtual Queue</p>
                </div>
                <div className="w-px h-8 bg-zinc-200" />
                <div>
                  <p className="text-xl font-black text-teal-600">0 min</p>
                  <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Lobby Waiting</p>
                </div>
              </div>
            </div>

            {/* Right Column: Clean Interactive Mockup */}
            <div className="lg:col-span-5 flex justify-center">
              <motion.div
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
                  <span className="text-base">🔔</span>
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
          <div className="bg-zinc-950 text-white rounded-3xl p-8 sm:p-14 text-center sm:text-left flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
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
                className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all text-center"
              >
                Get Started
              </button>
              <button
                type="button"
                onClick={() => navigate('/business')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider border border-zinc-700 active:scale-95 transition-all text-center"
              >
                For Business
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Simple Minimal Footer ── */}
      <footer className="border-t border-zinc-200/80 py-10 bg-white text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="serveQ Logo" className="w-5 h-5 object-contain" />
            <span className="font-bold text-zinc-900">serveQ</span>
            <span>• Smart Virtual Queuing</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/business" className="hover:text-zinc-900 transition-colors">Business Portal</Link>
            <Link to="/login" className="hover:text-zinc-900 transition-colors">Sign In</Link>
            <a href="#how-it-works" className="hover:text-zinc-900 transition-colors">How It Works</a>
          </div>
          <p>© {new Date().getFullYear()} serveQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
