import { motion } from 'framer-motion'

export default function QueueCard({ user, position, isMe, totalUsers }) {
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
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, x: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 shadow-xs ${
        isMe 
          ? 'bg-teal-50 border-teal-200' 
          : isServing 
            ? 'bg-emerald-50 border-emerald-200' 
            : 'bg-white border-zinc-200 hover:bg-zinc-50'
      }`}
    >
      {/* Visual Indicator for 'Me' */}
      {isMe && <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-600 rounded-l-xl" />}

      {/* Position indicator */}
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 transition-colors ${
          isServing 
            ? 'bg-emerald-100 text-emerald-700' 
            : isMe 
              ? 'bg-teal-600 text-white' 
              : 'bg-slate-50 text-slate-500'
        }`}
      >
        {isServing ? '⚡' : position}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className={`font-bold tracking-tight truncate ${isMe ? 'text-teal-700 text-base' : 'text-zinc-950 text-sm'}`}>
            {isMe ? 'Your Position' : `Queue Ticket #${position}`}
          </span>
          {isServing && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border bg-emerald-100 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-xs font-medium text-slate-500 truncate max-w-[150px] sm:max-w-auto">
             {user.serviceType || 'General Service'} 
          </p>
          <span className="w-1 h-1 rounded-full bg-zinc-200" />
          <p className="text-xs font-medium text-slate-500">
            {user.serviceTime}m limit
          </p>
        </div>
      </div>

      <div className="text-right flex-shrink-0 pl-4 border-l border-zinc-200">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
          {isServing ? 'Ends At' : 'Target'}
        </p>
        <p className={`text-sm font-bold tabular-nums transition-colors ${
          isServing ? 'text-emerald-700' : isMe ? 'text-teal-700' : 'text-zinc-950'
        }`}>
          {isServing ? endTime : eta}
        </p>
      </div>
    </motion.div>
  )
}
