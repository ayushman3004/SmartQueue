import { motion } from 'framer-motion'

export default function QueueCard({ user, position, isMe, _totalUsers }) {
  const isServing = user.status === 'serving'

  const eta = user.estimatedStartTime
    ? new Date(user.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  const endTime = user.estimatedStartTime && user.serviceTime
    ? new Date(new Date(user.estimatedStartTime).getTime() + user.serviceTime * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, x: -8 }}
      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
      className={`p-1 rounded-2xl border transition-all duration-200 ${
        isMe 
          ? 'bg-teal-500/10 border-teal-300 shadow-sm' 
          : isServing 
            ? 'bg-emerald-500/10 border-emerald-300 shadow-sm' 
            : 'bg-zinc-100/70 border-zinc-200/80 hover:border-zinc-300'
      }`}
    >
      <div className="bg-white rounded-[calc(1rem-2px)] p-3 sm:p-3.5 flex flex-col gap-2.5 shadow-xs">
        {/* Top Header inside ticket */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Position Number Pill */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-transform ${
                isServing 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : isMe 
                    ? 'bg-teal-600 text-white shadow-xs' 
                    : 'bg-zinc-100 text-zinc-600 border border-zinc-200/70'
              }`}
            >
              {isServing ? 'NOW' : `#${position}`}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`font-black tracking-tight text-xs sm:text-sm truncate ${isMe ? 'text-teal-700' : 'text-zinc-950'}`}>
                  {isMe ? 'Your Current Slot' : `Queue Ticket #${position}`}
                </span>
                {isServing ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full border bg-emerald-50 text-[8.5px] font-extrabold uppercase tracking-wider text-emerald-700 border-emerald-200 shrink-0">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-radar" />
                    Serving
                  </span>
                ) : isMe ? (
                  <span className="px-1.5 py-0.2 rounded-full bg-teal-100/70 text-teal-800 text-[8.5px] font-extrabold uppercase tracking-wider border border-teal-200 shrink-0">
                    You
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Status / ETA Badge */}
          <div className="text-right shrink-0">
            <p className="text-[8.5px] font-extrabold uppercase tracking-widest text-zinc-400">
              {isServing ? 'Finish ETA' : 'Ready Slot'}
            </p>
            <p className={`text-xs sm:text-sm font-black tabular-nums leading-tight ${
              isServing ? 'text-emerald-700' : isMe ? 'text-teal-700' : 'text-zinc-900'
            }`}>
              {isServing ? endTime : eta}
            </p>
          </div>
        </div>

        {/* Bottom Details Row */}
        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 pt-1.5 border-t border-zinc-100">
          <span className="truncate">{user.serviceType || 'General Consultation'}</span>
          <span className="font-semibold text-zinc-600 shrink-0 ml-2">{user.serviceTime}m block</span>
        </div>
      </div>
    </motion.div>
  )
}
