import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

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

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="container overflow-x-hidden pt-12 px-4 sm:px-6">
      {/* Background blobs for premium feel */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] left-[10%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Hero Section */}
      <section className="min-h-[85vh] flex flex-col items-start justify-center text-left space-y-10 relative py-20">
        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           className="px-6 py-2.5 rounded-2xl bg-teal-50 border border-teal-100 text-[10px] font-black uppercase tracking-[0.4em] text-teal-700 shadow-sm"
        >
          Productivity Infrastructure
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-[7.5rem] font-black text-zinc-950 tracking-tighter leading-[0.95] max-w-6xl uppercase italic"
        >
          Eliminate <br />
          the <span className="text-teal-600">Wait.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xl md:text-2xl text-slate-500 font-bold max-w-2xl leading-relaxed uppercase tracking-tight"
        >
          A seamless SaaS platform designed to completely modernise your operations. Give your customers real-time updates and eliminate physical bottlenecks instantly.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center gap-6 pt-6"
        >
          <button 
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto px-12 py-6 rounded-3xl bg-zinc-950 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-zinc-950/20 hover:bg-zinc-800 transition-all hover:-translate-y-1 active:scale-[0.98] group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative z-10">Start Deployment</span>
          </button>
          <button 
             onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
             className="w-full sm:w-auto px-12 py-6 rounded-3xl bg-white border border-zinc-200 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-950 shadow-xl hover:bg-slate-50 transition-all active:scale-[0.98]"
          >
            View Specs
          </button>
        </motion.div>
      </section>

      {/* Value Prop Section */}
      <section id="features" className="py-32 space-y-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-zinc-100 pb-12">
           <div className="space-y-4 max-w-3xl">
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-600">Core Engine</span>
             <h2 className="text-4xl md:text-6xl font-black text-zinc-950 tracking-tighter uppercase italic leading-none">Platform <span className="text-teal-600">Capabilities</span></h2>
             <p className="text-slate-400 text-lg font-bold uppercase tracking-tight">Everything you need to virtualize your physical waiting rooms.</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {FEATURES.map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white border border-zinc-200 p-10 group hover:border-teal-500/30 transition-all rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:-translate-y-2"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-zinc-100 flex items-center justify-center text-3xl mb-8 grayscale group-hover:grayscale-0 transition-all opacity-80 group-hover:opacity-100 shadow-inner">
                {f.icon}
              </div>
              <h3 className="text-xl font-black text-zinc-950 mb-3 uppercase italic tracking-tight">{f.title}</h3>
              <p className="text-slate-500 font-bold leading-relaxed uppercase text-[11px] tracking-widest opacity-80 group-hover:text-zinc-950 transition-colors">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-32 text-left">
         <div className="bg-zinc-950 p-12 md:p-24 rounded-[4rem] space-y-10 flex flex-col md:flex-row items-center justify-between gap-16 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="space-y-6 relative z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-500">Genesis Point</span>
              <h2 className="text-5xl md:text-8xl font-black text-white tracking-tighter uppercase italic leading-[0.9]">Ready to <br />launch?</h2>
              <p className="text-slate-400 text-lg font-bold uppercase tracking-tight max-w-lg">Join forward-thinking businesses upgrading their operational infrastructure.</p>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="relative z-10 px-16 py-8 rounded-[2rem] bg-white text-zinc-950 text-xs font-black uppercase tracking-[0.4em] shadow-2xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
            >
              Sign Up Genesis
            </button>
         </div>
      </section>
    </div>
  )
}
