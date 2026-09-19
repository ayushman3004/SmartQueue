import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function BackButton() {
  const navigate = useNavigate()
  const location = useLocation()

  // Don't show on dashboard/home
  if (location.pathname === '/' || location.pathname === '/login') return null

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      onClick={() => navigate(-1)}
      className="fixed top-24 left-6 z-40 p-3 rounded-full bg-white/80 backdrop-blur-md border border-zinc-200/90 text-zinc-600 hover:text-teal-700 hover:border-teal-300 hover:bg-white transition-all active:scale-[0.96] group shadow-lg shadow-zinc-950/5 flex items-center gap-2"
      aria-label="Go Back"
    >
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      <span className="text-[10px] font-extrabold uppercase tracking-wider pr-1 hidden group-hover:inline-block transition-all">
        Back
      </span>
    </motion.button>
  )
}
