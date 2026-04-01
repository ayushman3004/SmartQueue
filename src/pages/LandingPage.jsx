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
    <div className="container overflow-x-hidden pt-12">
      {/* Hero Section */}
      <section className="min-h-[75vh] flex flex-col items-start justify-center text-left space-y-8 relative">
        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           className="px-4 py-2 rounded-md bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-teal-400"
        >
          Productivity Infrastructure
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-8xl font-black text-white tracking-tight leading-[1.1] max-w-4xl"
        >
          Eliminate the Wait. <br />
          Optimize the <span className="text-teal-500">Flow.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg md:text-xl text-zinc-400 font-medium max-w-2xl leading-relaxed"
        >
          A seamless SaaS platform designed to completely modernise your operations. Give your customers real-time updates and eliminate physical bottlenecks instantly.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center gap-4 pt-4"
        >
          <button 
            onClick={() => navigate('/login')}
            className="btn-primary py-4 px-10 text-sm w-full sm:w-auto"
          >
            Start for Free
          </button>
          <button 
             onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
             className="px-10 py-4 rounded-lg bg-zinc-800/50 border border-white/10 text-sm font-bold text-white hover:bg-white/10 transition-colors w-full sm:w-auto"
          >
            View Features
          </button>
        </motion.div>
      </section>

      {/* Value Prop Section */}
      <section id="features" className="py-24 space-y-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/10 pb-8">
           <div className="space-y-4 max-w-2xl">
             <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">Platform <span className="text-teal-500">Capabilities</span></h2>
             <p className="text-zinc-400 text-lg font-medium">Everything you need to virtualize your physical waiting rooms.</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass p-8 group hover:border-teal-500/50 transition-colors rounded-2xl"
            >
              <div className="text-4xl mb-6 grayscale group-hover:grayscale-0 transition-all opacity-80 group-hover:opacity-100">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
              <p className="text-zinc-400 font-medium leading-relaxed group-hover:text-zinc-300 transition-colors">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 text-left">
         <div className="glass p-12 md:p-20 rounded-3xl space-y-8 flex flex-col md:flex-row items-center justify-between gap-12 border-teal-500/10">
            <div className="space-y-6">
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">Ready to launch?</h2>
              <p className="text-zinc-400 text-lg font-medium max-w-lg">Join forward-thinking businesses upgrading their operational infrastructure.</p>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="btn-primary py-5 px-12 text-sm whitespace-nowrap"
            >
              Create Free Account
            </button>
         </div>
      </section>
    </div>
  )
}
