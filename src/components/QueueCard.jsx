import { motion } from 'framer-motion'

export default function QueueCard({ user, position, isMe, totalUsers }) {
  const isServing = user.status === 'serving'

  const eta = user.estimatedStartTime
    ? new Date(user.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className={`flex items-center gap-4 p-4 rounded-xl border ${
        isMe ? 'border-[var(--cyan)]' : ''
      }`}
      style={{
        background: isServing ? 'rgba(0,230,118,0.06)' : isMe ? 'rgba(0,229,255,0.06)' : 'var(--bg-elevated)',
        borderColor: isServing ? 'rgba(0,230,118,0.3)' : isMe ? 'var(--cyan)' : 'var(--border)',
        boxShadow: isMe ? '0 0 20px rgba(0,229,255,0.12)' : 'none',
      }}
    >
      {/* Position number */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
        style={{
          background: isServing ? 'var(--green-dim)' : isMe ? 'var(--cyan-dim)' : 'var(--bg-base)',
          color: isServing ? 'var(--green)' : isMe ? 'var(--cyan)' : 'var(--text-muted)',
          border: `1px solid ${isServing ? 'rgba(0,230,118,0.3)' : isMe ? 'var(--border-bright)' : 'var(--border)'}`,
        }}
      >
        {isServing ? '✓' : position}
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {isMe ? 'You' : `User #${position}`}
          </span>
          {isServing && (
            <span className="badge-serving">
              <span className="pulse-dot" />
              Serving
            </span>
          )}
          {isMe && !isServing && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)' }}>
              You
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          ~{user.serviceTime} min service
        </p>
      </div>

      {/* ETA */}
      <div className="text-right flex-shrink-0">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ETA</p>
        <p className="font-bold text-sm" style={{ color: isServing ? 'var(--green)' : 'var(--amber)' }}>
          {isServing ? 'Now!' : eta}
        </p>
      </div>
    </motion.div>
  )
}
