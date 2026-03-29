import { motion } from 'framer-motion'

export default function QueueCard({ user, position, isMe, totalUsers }) {
  const isServing = user.status === 'serving'

  const eta = user.estimatedStartTime
    ? new Date(user.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, x: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`relative flex items-center gap-5 p-5 rounded-[2rem] border transition-all duration-300 ${
        isMe 
          ? 'bg-cyan-500/10 border-cyan-500/30 shadow-[0_10px_30px_-10px_rgba(6,182,212,0.2)]' 
          : isServing 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
      }`}
    >
      {/* Visual Indicator for 'Me' */}
      {isMe && <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-10 bg-cyan-500 rounded-full blur-[2px]" />}

      {/* Position indicator */}
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 border transition-all ${
          isServing 
            ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
            : isMe 
              ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]' 
              : 'bg-neutral-900 text-neutral-500 border-white/5'
        }`}
      >
        {isServing ? (
          <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            ⚡
          </motion.span>
        ) : (
          `#0${position}`.slice(-3)
        )}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className={`font-black tracking-tight truncate ${isMe ? 'text-cyan-400 text-lg' : 'text-neutral-300 text-sm'}`}>
            {isMe ? 'My Session' : `Customer Hub #${position}`}
          </span>
          {isServing && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[10px] font-black uppercase tracking-widest text-emerald-500 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
             {user.serviceType || 'General'} Service 
          </p>
          <span className="w-1 h-1 rounded-full bg-neutral-800" />
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
            {user.serviceTime}m duration
          </p>
        </div>
      </div>

      {/* Live ETA */}
      <div className="text-right flex-shrink-0 pl-4 border-l border-white/5">
        <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mb-1">Target Slot</p>
        <p className={`text-sm font-black font-mono transition-colors ${
          isServing ? 'text-emerald-400' : isMe ? 'text-cyan-400' : 'text-neutral-400'
        }`}>
          {isServing ? 'NOW' : eta}
        </p>
      </div>
    </motion.div>
  )
}

