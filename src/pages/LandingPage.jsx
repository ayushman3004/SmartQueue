import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

const FEATURES = [
  {
    icon: '🔮',
    title: 'AI Wait Forecasting',
    desc: 'Our proprietary Gemini-powered models analyze live hub traffic to provide down-to-the-minute ETA predictions.'
  },
  {
    icon: '💳',
    title: 'Smart Wallet Sync',
    desc: 'Seamlessly reserve slots with our integrated Rupee wallet. Secure refunds and compensation are processed in real-time.'
  },
  {
    icon: '⚡',
    title: 'Zero-Latency Updates',
    desc: 'Experience lightning-fast queue synchronization across all your devices using advanced WebSocket infrastructure.'
  },
  {
    icon: '🏢',
    title: 'Enterprise Dashboard',
    desc: 'Business owners get full control over their operations with live traffic insights and customer flow management tools.'
  }
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="container overflow-x-hidden pt-12">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center text-center space-y-12">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none -z-10" />
        
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="px-6 py-2 rounded-full glass border-white/5 text-[10px] font-black uppercase tracking-[0.5em] text-cyan-400"
        >
          Redefining the Waiting Experience
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-9xl font-black text-white tracking-tighter italic leading-[0.8] mb-4"
        >
          SMART <br />
          <span className="gradient-text italic">QUEUE 2.0</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xl md:text-2xl text-neutral-400 font-medium max-w-3xl leading-relaxed"
        >
          The ultimate liquid infrastructure for physical hubs. Skip the line, track your status in real-time, and reclaim your most valuable asset: <span className="text-white font-black italic">Time</span>.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center gap-6 pt-8"
        >
          <button 
            onClick={() => navigate('/login')}
            className="btn-primary py-6 px-16 text-xs shadow-[0_0_50px_rgba(6,182,212,0.3)]"
          >
            Launch Your Hub →
          </button>
          <button 
             onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
             className="px-12 py-6 rounded-2xl glass border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 transition-all"
          >
            Discover Tech Stack
          </button>
        </motion.div>
      </section>

      {/* Value Prop Section */}
      <section id="features" className="py-32 space-y-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
           <div className="space-y-4 max-w-2xl">
             <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-none">Why Choose <br/> <span className="gradient-text italic">SmartQueue?</span></h2>
             <p className="text-neutral-500 text-lg font-medium">We bridge the gap between digital convenience and physical presence.</p>
           </div>
           <div className="hidden md:block w-32 h-px bg-white/10 mb-8" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {FEATURES.map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass p-10 group hover:border-cyan-500/30 transition-all rounded-[3rem] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-5xl mb-8 grayscale group-hover:grayscale-0 transition-all transform group-hover:scale-110 active:rotate-12 duration-500">
                {f.icon}
              </div>
              <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter italic">{f.title}</h3>
              <p className="text-neutral-500 font-medium leading-relaxed group-hover:text-neutral-300 transition-colors">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-32 text-center">
         <div className="glass p-16 md:p-32 rounded-[4rem] space-y-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-br from-cyan-500/10 to-transparent pointer-events-none" />
            <h2 className="text-5xl md:text-8xl font-black text-white tracking-tighter italic leading-tight">Ready to <br/> reclaim your day?</h2>
            <p className="text-neutral-400 text-xl font-medium max-w-xl mx-auto">Join thousands of users who are already skipping the line at their favorite restaurants, clinics, and banks.</p>
            <button 
              onClick={() => navigate('/login')}
              className="btn-primary py-7 px-20 text-xs"
            >
              Create Free Account
            </button>
         </div>
      </section>
    </div>
  )
}
