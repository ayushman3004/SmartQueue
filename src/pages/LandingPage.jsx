import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

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
    <div className="w-full overflow-x-hidden bg-white">
      {/* Background blobs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] left-[10%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Hero Section */}
      <section className="relative pt-4 md:pt-4 pb-24 lg:pb-40">
        <div className="container mx-auto px-6 sm:px-10 lg:px-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center">
            {/* Content Left */}
            <div className="flex flex-col items-start text-left space-y-12 lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-8 py-3 rounded-[1.25rem] bg-teal-50 border border-teal-100 text-[11px] font-black uppercase tracking-[0.4em] text-teal-700 shadow-sm"
              >
                Productivity Infrastructure
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-6xl md:text-7xl lg:text-7xl xl:text-8xl 2xl:text-[9rem] font-black text-zinc-950 tracking-tighter leading-[1.0] uppercase"
              >
                Eliminate <br />
                the <span className="text-teal-600">Wait.</span>
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg md:text-xl text-slate-500 font-bold leading-relaxed max-w-xl uppercase tracking-tight opacity-80"
              >
                A seamless SaaS platform designed to completely modernise your operations. Give your customers real-time updates and eliminate physical bottlenecks instantly.
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center gap-6 pt-6 w-full sm:w-auto"
              >
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-16 py-8 rounded-[2.5rem] bg-zinc-950 text-white text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-zinc-800 transition-all hover:-translate-y-2 active:scale-[0.98]"
                >
                  Start Deployment
                </button>
                <button 
                   onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                   className="w-full sm:w-auto px-16 py-8 rounded-[2.5rem] bg-white border border-zinc-200 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-950 shadow-xl hover:bg-slate-50 transition-all hover:-translate-y-1 active:scale-[0.98]"
                >
                  View Specs
                </button>
              </motion.div>
            </div>

            {/* Viz Right */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, x: 50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
              className="relative group hidden lg:block lg:col-span-5"
            >
              <div className="absolute inset-x-[-10%] inset-y-[-10%] bg-teal-500/10 blur-[120px] -z-10 group-hover:bg-teal-500/20 transition-all duration-1000" />
              <div className="relative rounded-[4rem] overflow-hidden shadow-[0_60px_120px_-20px_rgba(0,0,0,0.35)] border border-zinc-100">
                <img src="/hero-viz.png" className="w-full h-auto object-cover transform transition-transform duration-1000 group-hover:scale-110" alt="Platform Visualization" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent pointer-events-none" />
              </div>
            </motion.div>
          </div>
        </div>

        <div className="mt-24 mb-24">
          <ImageMarquee />
        </div>

        <Marquee />
      </section>

      {/* Value Prop Section */}
      <section id="features" className="py-40 space-y-24 relative overflow-hidden bg-white">
        <div className="absolute inset-0 z-0 opacity-[0.15] pointer-events-none transition-opacity duration-1000">
          <img src="/features-bg.png" className="w-full h-full object-cover" alt="" />
        </div>
        <div className="container mx-auto px-6 sm:px-10 lg:px-24 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 border-b border-zinc-100 pb-16">
           <div className="space-y-6 max-w-3xl">
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-600">Core Engine</span>
             <h2 className="text-5xl md:text-7xl font-black text-zinc-950 tracking-tighter uppercase leading-none">Platform <span className="text-teal-600">Capabilities</span></h2>
             <p className="text-slate-400 text-lg md:text-xl font-bold uppercase tracking-tight">Everything you need to virtualize your physical waiting rooms.</p>
           </div>
          </div>
 
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {FEATURES.map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white border border-zinc-200 p-12 group hover:border-teal-500/30 transition-all rounded-[3rem] shadow-xl hover:shadow-2xl hover:-translate-y-2"
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-zinc-100 flex items-center justify-center text-3xl mb-8 grayscale group-hover:grayscale-0 transition-all opacity-80 group-hover:opacity-100 shadow-inner">
                  {f.icon}
                </div>
                <h3 className="text-2xl font-black text-zinc-950 mb-4 uppercase tracking-tight">{f.title}</h3>
                <p className="text-slate-500 font-bold leading-relaxed uppercase text-xs tracking-widest opacity-80 group-hover:text-zinc-950 transition-colors">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-40 px-6">
        <div className="container mx-auto">
          <div className="bg-zinc-950 p-16 md:p-32 rounded-[5rem] space-y-12 flex flex-col xl:flex-row items-center justify-between gap-16 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] relative overflow-hidden text-left">
            <div className="absolute inset-0 opacity-30 pointer-events-none mix-blend-overlay">
              <img src="/cta-bg.png" className="w-full h-full object-cover" alt="" />
            </div>
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-500/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="space-y-8 relative z-10 max-w-2xl">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-500">Genesis Point</span>
              <h2 className="text-6xl md:text-9xl font-black text-white tracking-tighter uppercase leading-[0.85]">Ready to <br />launch?</h2>
              <p className="text-slate-300 text-xl font-bold uppercase tracking-tight opacity-70">Join forward-thinking businesses upgrading their operational infrastructure.</p>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="relative z-10 px-20 py-10 rounded-[2.5rem] bg-white text-zinc-950 text-sm font-black uppercase tracking-[0.5em] shadow-2xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
            >
              Sign Up Genesis
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
