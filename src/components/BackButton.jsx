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
      className="fixed top-28 left-8 z-40 p-4 rounded-2xl bg-white border border-zinc-200 text-slate-400 hover:text-teal-600 hover:border-teal-200 hover:bg-slate-50 transition-all active:scale-95 group shadow-xl"
    >
      <div className="flex items-center gap-3">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] hidden group-hover:inline-block transition-all">Previous Node</span>
      </div>
    </motion.button>
  )
}
