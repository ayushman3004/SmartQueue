import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function BackButton() {
  const navigate = useNavigate()
  const location = useLocation()

  // Don't show on dashboard/home
  if (location.pathname === '/' || location.pathname === '/login') return null

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => navigate(-1)}
      className="fixed top-24 left-6 z-40 p-3 rounded-2xl glass-bright text-neutral-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all active:scale-95 group shadow-2xl"
    >
      <div className="flex items-center gap-2">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:inline-block transition-all">Back</span>
      </div>
    </motion.button>
  )
}
