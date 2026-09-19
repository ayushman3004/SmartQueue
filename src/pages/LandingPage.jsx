import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import React from 'react'

const FEATURES = [
  {
    icon: '⏱️',
    title: 'Live System Positioning',
    desc: 'Monitor real-time hub traffic to track exact wait times and queue flow with pinpoint precision.'
  },
  {
    icon: '💳',
    title: 'Seamless Payments',
    desc: 'Reserve slots instantly with integrated payments. Secure refunds process automatically if plans change.'
  },
  {
    icon: '⚡',
    title: 'Zero-Latency Sync',
    desc: 'Built on high-performance WebSockets to ensure your status immediately syncs across all devices.'
  },
  {
    icon: '🏢',
    title: 'Business Infrastructure',
    desc: 'Equip your team with an enterprise-grade dashboard to completely manage and optimize customer flow.'
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

function Marquee() {
  const slogans = [
    "70% REDUCTION IN PHYSICAL WAIT TIMES",
    "ENTERPRISE SCALABILITY",
    "LIVE GLOBAL OPS",
    "SEAMLESS PAYMENTS",
    "ZERO-LATENCY SYNC",
    "AI-POWERED OPTIMIZATION"
  ]
  
  return (
    <div className="w-full bg-teal-600 py-8 overflow-hidden border-y border-teal-500 shadow-[0_20px_50px_rgba(13,148,136,0.2)]">
      <motion.div 
        animate={{ x: [0, -1500] }}
        transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
        className="flex whitespace-nowrap gap-20 items-center"
      >
        {[...slogans, ...slogans, ...slogans].map((s, i) => (
          <span key={i} className="text-white text-[10px] md:text-sm font-black uppercase tracking-[0.5em] flex items-center gap-8">
            {s} <div className="w-2 h-2 rounded-full bg-white/20" />
          </span>
        ))}
      </motion.div>
    </div>
  )
}

function ImageMarquee() {
  return (
    <div className="w-full py-12 overflow-hidden bg-white">
      <motion.div 
        animate={{ x: [0, -2500] }}
        transition={{ repeat: Infinity, duration: 80, ease: "linear" }}
        className="flex whitespace-nowrap gap-8 items-center"
      >
        {[...HUB_IMAGES, ...HUB_IMAGES, ...HUB_IMAGES].map((img, i) => (
          <div key={i} className="relative w-[450px] md:w-[600px] h-[350px] md:h-[450px] rounded-[3rem] overflow-hidden flex-shrink-0 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] border border-zinc-100 group">
             <img src={img.url} className="w-full h-full object-cover grayscale-[0.3] transition-all duration-1000 group-hover:grayscale-0 group-hover:scale-105" alt={img.title} />
             <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/20 to-transparent flex flex-col justify-end p-10">
               <span className="text-teal-400 text-[10px] font-black uppercase tracking-[0.4em] mb-3">{img.title}</span>
               <p className="text-white text-base font-bold uppercase tracking-tight opacity-90 leading-tight max-w-sm">{img.desc}</p>
             </div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="w-full overflow-x-hidden bg-[#fafaf9]">
      {/* Ambient background mesh */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[5%] right-[12%] w-[550px] h-[550px] bg-teal-500/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-[15%] left-[8%] w-[500px] h-[500px] bg-indigo-500/6 rounded-full blur-[130px]" />
      </div>

      {/* Hero Section */}
      <section className="relative pt-6 pb-20 lg:pb-32">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Content Left */}
            <div className="flex flex-col items-start text-left space-y-8 lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="badge-eyebrow"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
                Virtual Queue Infrastructure
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-zinc-950 tracking-tight leading-[0.96]"
              >
                Eliminate <br />
                the <span className="text-teal-600 underline decoration-teal-500/30 decoration-wavy decoration-2">Waiting Room.</span>
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="text-base sm:text-lg text-zinc-600 font-medium leading-relaxed max-w-xl"
              >
                Zero-friction virtual waiting queues, live AI pacing, and instant Express Slot bookings designed for healthcare, banking, and high-volume operations.
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="flex flex-wrap items-center gap-4 pt-2 w-full sm:w-auto"
              >
                <button 
                  onClick={() => navigate('/login')}
                  className="btn-island py-3.5 px-6 text-xs sm:text-sm"
                >
                  <span>Start Deployment</span>
                  <span className="btn-bubble">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                </button>

                <button 
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-6 py-3.5 rounded-full bg-white border border-zinc-200/90 text-zinc-800 text-xs sm:text-sm font-extrabold uppercase tracking-wider shadow-sm hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-[0.97]"
                >
                  Explore Capabilities
                </button>
              </motion.div>
            </div>

            {/* Visual Right (Double-Bezel Frame) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="lg:col-span-5"
            >
              <div className="bezel-shell">
                <div className="bezel-core overflow-hidden relative group">
                  <img 
                    src="/hero-viz.png" 
                    className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105" 
                    alt="Platform Visualization" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent pointer-events-none" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="mt-16 mb-16">
          <ImageMarquee />
        </div>

        <Marquee />
      </section>

      {/* Capabilities Section (Double-Bezel Bento Grid) */}
      <section id="features" className="py-24 space-y-16 relative overflow-hidden bg-white border-t border-zinc-200/60">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-12 border-b border-zinc-100">
            <div className="space-y-3 max-w-2xl text-left">
              <div className="badge-eyebrow">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                Core Technology
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
                Architected for <span className="text-teal-600">Zero-Friction</span> Flow.
              </h2>
              <p className="text-zinc-500 text-sm sm:text-base font-medium">
                Everything required to transform physical waiting rooms into synchronous real-time digital queues.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            {FEATURES.map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="bezel-shell text-left group"
              >
                <div className="bezel-core p-8 sm:p-10 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-center text-2xl shadow-xs group-hover:scale-105 transition-transform duration-200">
                    {f.icon}
                  </div>
                  <h3 className="text-xl font-black text-zinc-950 tracking-tight">{f.title}</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
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
    </div>
  )
}
