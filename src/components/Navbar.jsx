import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

export default function Navbar() {
  const { user, logOut } = useAuth()
  const { connected } = useSocket()
  const navigate = useNavigate()
  const location = useLocation()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = () => {
    logOut()
    navigate('/login')
  }

  const navLinks = user ? [
    { name: 'Dashboard', path: '/' },
    { name: 'Wallet', path: '/wallet' },
    { name: 'Profile', path: '/profile' },
    ...(user?.role === 'admin' ? [{ name: 'Admin', path: '/admin' }] : []),
  ] : []

  if (!user) return null

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'py-3' : 'py-5'
    }`}>
      <div className="container">
        <div className={`relative flex items-center justify-between p-2 pl-4 md:pl-6 pr-2 rounded-full transition-all duration-300 border ${
          isScrolled 
            ? 'glass-pill border-zinc-200/90 shadow-lg shadow-zinc-950/5' 
            : 'bg-white/70 backdrop-blur-md border-zinc-200/60 shadow-sm'
        }`}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-md shadow-teal-600/10 group-hover:scale-105 transition-transform duration-200 overflow-hidden border border-zinc-200/70 p-1">
              <img src="/logo.png" alt="serveQ" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-zinc-950 leading-none">serveQ</span>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.25em] text-teal-600 mt-0.5">Enterprise Hub</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1.5 ml-8 mr-auto">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all no-underline ${
                  location.pathname === link.path 
                    ? 'bg-teal-50 text-teal-700 border border-teal-200/60 shadow-xs' 
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/60'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link 
                  to="/wallet"
                  className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-zinc-50 border border-zinc-200/80 hover:border-teal-300 transition-all no-underline group active:scale-[0.98]"
                >
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Wallet</span>
                  <span className="text-xs font-black text-teal-700 group-hover:text-teal-800">
                    ₹{(user.walletBalance ?? 0).toLocaleString()}
                  </span>
                </Link>

                <div className="flex items-center gap-1.5">
                  <Link 
                    to="/profile" 
                    className="flex items-center gap-2.5 p-1 pr-3.5 rounded-full bg-zinc-50 border border-zinc-200/80 hover:border-zinc-300 transition-all no-underline group active:scale-[0.98]"
                  >
                    <div className="relative">
                      {user.avatar ? (
                        <img src={user.avatar} className="w-8 h-8 rounded-full object-cover border border-zinc-200" alt="Avatar" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white bg-teal-600 shadow-xs">
                          {user.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                      {connected && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full animate-radar" />
                      )}
                    </div>
                    <div className="hidden sm:flex flex-col text-left">
                      <span className="text-xs font-bold text-zinc-950 leading-tight group-hover:text-teal-700 transition-colors">
                        {user.name?.split(' ')[0]}
                      </span>
                      <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-wider">
                        {user.role}
                      </span>
                    </div>
                  </Link>

                  <button 
                    onClick={handleLogout}
                    className="p-2.5 rounded-full bg-zinc-50 border border-zinc-200/80 text-zinc-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50 transition-all active:scale-[0.96]"
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <Link to="/login" className="btn-island py-2 px-4.5 text-xs">
                <span>Access Portal</span>
                <span className="btn-bubble">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </Link>
            )}

            {/* Mobile Animated Morphing Hamburger */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden relative w-10 h-10 rounded-full bg-zinc-50 text-zinc-700 border border-zinc-200/80 flex items-center justify-center active:scale-[0.96]"
              aria-label="Toggle Navigation"
            >
              <div className="w-4 h-3.5 flex flex-col justify-between items-center">
                <span className={`w-full h-0.5 bg-zinc-800 rounded-full transition-transform duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-[6px]' : ''}`} />
                <span className={`w-full h-0.5 bg-zinc-800 rounded-full transition-opacity duration-200 ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
                <span className={`w-full h-0.5 bg-zinc-800 rounded-full transition-transform duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-[6px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Glass Menu with Staggered Items */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="md:hidden container mt-2"
          >
            <div className="glass p-5 rounded-3xl border border-zinc-200/80 shadow-2xl space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-2xl text-sm font-bold no-underline transition-colors ${
                    location.pathname === link.path 
                      ? 'bg-teal-50 text-teal-700 border border-teal-200/60' 
                      : 'text-zinc-700 hover:bg-zinc-100/70'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              {user && (
                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-500">Wallet:</span>
                    <span className="text-sm font-black text-teal-700">₹{user.walletBalance}</span>
                  </div>
                  <button 
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }} 
                    className="text-rose-600 font-extrabold uppercase text-[10px] tracking-widest px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
