import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import React from 'react'
import MetroHero from '../components/MetroHero'
import ImageStreamHero from '../components/ImageStreamHero'
import SqueezeCarousel from '../components/SqueezeCarousel'
import PerfToggle from '../components/PerfToggle'

const FEATURE_SLIDES = [
  {
    id: 'positioning',
    title: 'Live System Positioning.',
    description: 'Monitor real-time hub traffic to track exact wait times and queue flow with pinpoint precision.',
    image: '/hero-viz.png',
    overlay: (
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white text-xs font-bold tracking-wide">
        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
        Live Geo-Queue Radar
      </div>
    ),
    action: 'Start Queue',
    href: '/login'
  },
  {
    id: 'payments',
    title: 'Seamless Payments.',
    description: 'Reserve slots instantly with integrated payments. Secure refunds process automatically if plans change.',
    image: '/hubs/bank.png',
    overlay: (
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white text-xs font-bold tracking-wide">
        <span className="text-teal-300">💳</span>
        Automated Escrow Checkout
      </div>
    ),
    action: 'Reserve Priority',
    href: '/login'
  },
  {
    id: 'sync',
    title: 'Zero-Latency Sync.',
    description: 'Built on high-performance WebSockets to ensure your status immediately syncs across all devices.',
    image: '/dash-dark-bg.png',
    overlay: (
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white text-xs font-bold tracking-wide">
        <span className="text-amber-400">⚡</span>
        Sub-10ms WebSocket Mesh
      </div>
    ),
    action: 'View System State',
    href: '/login'
  },
  {
    id: 'infrastructure',
    title: 'Business Infrastructure.',
    description: 'Equip your team with an enterprise-grade dashboard to completely manage and optimize customer flow.',
    image: '/cta-bg.png',
    overlay: (
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white text-xs font-bold tracking-wide">
        <span className="text-cyan-300">🏢</span>
        Enterprise Command Center
      </div>
    ),
    action: 'Deploy Venue',
    href: '/login'
  },
  {
    id: 'forecasting',
    title: 'Predictive Wait-Time AI.',
    description: 'Heuristic forecasting estimates patient and customer turnaround based on live counter velocity.',
    image: '/hubs/clinic.png',
    overlay: (
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white text-xs font-bold tracking-wide">
        <span className="text-teal-300">🧠</span>
        Neural Wait Forecasting
      </div>
    ),
    action: 'Explore AI Engine',
    href: '/login'
  }
]

const HUB_IMAGES = [
  { url: '/hubs/restaurant.png', title: 'Restaurants', desc: 'Manage peak hour dining queues with zero friction.' },
  { url: '/hubs/salon.png', title: 'Salons', desc: 'Optimize stylist schedules and reduce client wait times.' },
  { url: '/hubs/clinic.png', title: 'Clinics', desc: 'Provide a stress-free environment for patient arrival.' },
  { url: '/hubs/bank.png', title: 'Banking', desc: 'Elite financial service management with digital precision.' },
  { url: '/hubs/retail.png', title: 'Retail', desc: 'High-fashion flow control for premium boutiques.' },
  { url: '/hubs/gov.png', title: 'Government', desc: 'Civilian-first architecture for modern public services.' }
]





export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="w-full overflow-x-hidden bg-[#05070d] text-white">
      {/* Ambient background mesh */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[5%] right-[12%] w-[550px] h-[550px] bg-teal-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[15%] left-[8%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[130px]" />
      </div>

      {/* Cinematic Locked Scroll-Scrub Video Hero */}
      <MetroHero 
        title="ELIMINATE THE WAITING ROOM"
        tagline="Zero-friction virtual waiting queues. Every door in the city is open without the wait."
        scrollHint="SCROLL TO EXPLORE"
        signature={false}
      >
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button 
            type="button"
            onClick={() => navigate('/login')}
            className="btn-island py-3.5 px-6 text-xs bg-teal-500 hover:bg-teal-400 text-zinc-950 font-black tracking-wider uppercase shadow-xl shadow-teal-500/25"
          >
            <span>Start Free Deployment</span>
            <span className="btn-bubble">→</span>
          </button>
          <button 
            type="button"
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/25 text-white text-xs font-bold uppercase tracking-wider transition-all"
          >
            Explore Platform ↓
          </button>
        </div>
      </MetroHero>

      {/* Live Venue 3D Perspective Stream Corridor */}
      <section className="relative py-12 sm:py-16 bg-[#05070d] text-white overflow-hidden border-b border-zinc-800/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-[2rem] sm:rounded-[2.5rem] bg-black border border-white/10 overflow-hidden shadow-2xl">
            <ImageStreamHero
              images={HUB_IMAGES}
              cards={10}
              speed={22}
              axis={56}
              className="w-full h-[500px] sm:h-[600px] md:h-[680px] lg:h-[740px]"
            >
              {/* Edge Gradient Fades */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-28 bg-gradient-to-r from-black to-transparent z-10" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-28 bg-gradient-to-l from-black to-transparent z-10" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/70 to-transparent z-10" />

              {/* Text Above */}
              <div className="absolute inset-x-0 top-8 sm:top-12 md:top-14 z-20 flex flex-col items-center text-center px-4 pointer-events-none">
                <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.08] max-w-3xl">
                  Deployable Across, <br />
                  Every High-Volume Venue.
                </h2>
              </div>

              {/* Caption Below */}
              <div className="absolute inset-x-0 bottom-5 sm:bottom-7 z-20 flex justify-center text-center px-4 pointer-events-none">
                <p className="text-zinc-400 text-xs sm:text-sm font-normal tracking-wide max-w-xl">
                  Dining, clinical care, financial branches, luxury retail, and public services moving with zero physical wait times.
                </p>
              </div>
            </ImageStreamHero>
          </div>
        </div>
      </section>

      {/* Capabilities Section (Interactive Squeeze Carousel) */}
      <section id="features" className="py-24 relative overflow-hidden bg-[#05070d] text-white border-t border-zinc-800/80">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-10 border-b border-zinc-800/80 mb-8">
            <div className="space-y-3 max-w-2xl text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-300 text-xs font-bold border border-teal-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                Core Technology
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Architected for <span className="text-teal-400">Zero-Friction</span> Flow.
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base font-medium">
                Everything required to transform physical waiting rooms into synchronous real-time digital queues.
              </p>
            </div>
          </div>

          <SqueezeCarousel 
            slides={FEATURE_SLIDES}
            height="clamp(280px, 34cqi, 440px)"
            radius={20}
            autoplay={true}
            interval={5000}
            hoverGrow={true}
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-8">
        <div className="container mx-auto">
          <div className="bg-zinc-950 p-10 sm:p-16 md:p-20 rounded-[2.5rem] flex flex-col xl:flex-row items-start xl:items-center justify-between gap-10 shadow-2xl relative overflow-hidden text-left border border-zinc-800">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[140px] pointer-events-none" />
            
            <div className="space-y-4 relative z-10 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-extrabold uppercase tracking-widest border border-teal-500/30">
                <span>⚡</span> Enterprise Ready
              </div>
              <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-none">
                Ready to transform <br />your venue?
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base font-medium">
                Equip your team with automated real-time queuing, digital booking, and AI wait predictions.
              </p>
            </div>

            <button 
              onClick={() => navigate('/login')}
              className="relative z-10 group px-8 py-4 rounded-full bg-white text-zinc-950 text-xs font-black uppercase tracking-widest shadow-2xl hover:bg-zinc-100 active:scale-[0.97] transition-all flex items-center gap-3"
            >
              <span>Launch Now</span>
              <span className="w-7 h-7 rounded-full bg-zinc-950 text-white flex items-center justify-center transition-transform group-hover:translate-x-1">
                →
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Floating Adaptive Performance & Cookie Settings */}
      <PerfToggle />
    </div>
  )
}
