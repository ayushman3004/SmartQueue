import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Stethoscope,
  Scissors,
  Ticket,
  Calendar,
  Clock,
  HelpCircle,
  Gift,
  X,
  User,
  Building2,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function CustomerSidebar({
  activeNavTab,
  onSelectTab,
  clinicsCount = 0,
  salonsCount = 0,
  myActiveQueuesCount = 0,
  myBookingsCount = 0,
  mobileOpen = false,
  onCloseMobile = () => {},
}) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const isOwner = user?.role === 'owner'
  const isAdmin = user?.role === 'admin'

  const navItems = isOwner
    ? [
        { id: 'dashboard', label: 'Hub Console', icon: Building2, route: '/business', count: null },
        { id: 'my-queues', label: 'Live Queues', icon: Ticket, route: '/queue', count: myActiveQueuesCount },
        { id: 'appointments', label: 'Appointments', icon: Calendar, route: '/booking', count: myBookingsCount },
        { id: 'history', label: 'History', icon: Clock, route: '/history', count: null },
        { id: 'profile', label: 'My Profile', icon: User, route: '/profile', count: null },
      ]
    : isAdmin
    ? [
        { id: 'dashboard', label: 'Admin Console', icon: LayoutDashboard, route: '/admin', count: null },
        { id: 'clinics', label: 'Clinics', icon: Stethoscope, route: '/customers?category=clinic', count: clinicsCount },
        { id: 'salons', label: 'Salons', icon: Scissors, route: '/customers?category=salon', count: salonsCount },
        { id: 'history', label: 'History', icon: Clock, route: '/history', count: null },
        { id: 'profile', label: 'My Profile', icon: User, route: '/profile', count: null },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, route: '/customers', count: null },
        { id: 'clinics', label: 'Clinics', icon: Stethoscope, route: '/customers?category=clinic', count: clinicsCount },
        { id: 'salons', label: 'Salons', icon: Scissors, route: '/customers?category=salon', count: salonsCount },
        { id: 'my-queues', label: 'My Queues', icon: Ticket, route: '/queue', count: myActiveQueuesCount },
        { id: 'appointments', label: 'Appointments', icon: Calendar, route: '/booking', count: myBookingsCount },
        { id: 'history', label: 'History', icon: Clock, route: '/history', count: null },
        { id: 'profile', label: 'My Profile', icon: User, route: '/profile', count: null },
      ]

  const handleItemClick = (item) => {
    if (onSelectTab) {
      onSelectTab(item.id, item.route)
    } else {
      navigate(item.route)
    }
    onCloseMobile()
  }

  const renderNavList = (isMobile = false) => (
    <div className="flex flex-col justify-between min-h-full h-full">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = activeNavTab === item.id
          const IconComponent = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#EAF5EC] text-[#114227] shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <IconComponent className={`w-4 h-4 ${isActive ? 'text-[#114227]' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.count !== null && item.count !== undefined && item.count > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-[#114227] text-white' : 'bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom Sidebar Actions */}
      <div className="pt-4 border-t border-zinc-100 space-y-1">
        <button
          type="button"
          onClick={() => {
            if (navigator?.clipboard) {
              navigator.clipboard.writeText('SERVEQ2026')
            }
            toast.success('Referral code copied to clipboard!')
            if (isMobile) onCloseMobile()
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
        >
          <Gift className="w-4 h-4 text-purple-600" />
          <span>Refer & Earn</span>
        </button>
        <button
          type="button"
          onClick={() => {
            navigate('/support')
            if (isMobile) onCloseMobile()
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-zinc-500" />
          <span>Help & Support</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside className="w-56 shrink-0 hidden lg:flex flex-col justify-between py-5 px-4 border-r border-zinc-200/70 h-[calc(100vh-61px)] h-[calc(100dvh-61px)] min-h-[calc(100vh-61px)] bg-white/40 sticky top-[61px] self-start overflow-y-auto">
        {renderNavList(false)}
      </aside>

      {/* Mobile Animated Left Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop Fade */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs"
            />

            {/* Sidebar Slide from Left */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-72 max-w-[85vw] bg-white h-full z-10 shadow-2xl p-4 flex flex-col justify-between overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
                <Link to="/customers" onClick={onCloseMobile} className="flex items-center gap-2 text-decoration-none">
                  <img src="/serveq-logo.png" alt="serveQ" className="h-6.5 w-auto object-contain" />
                  <span className="text-[9px] font-black uppercase text-[#114227] bg-[#EAF7EE] px-2 py-0.5 rounded-full border border-[#BDE8CB]">
                    Customer
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1">
                {renderNavList(true)}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
