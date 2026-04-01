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

  const navLinks = [
    { name: 'Dashboard', path: '/' },
    { name: 'Wallet', path: '/wallet' },
    { name: 'Profile', path: '/profile' },
    ...(user?.role === 'admin' ? [{ name: 'Admin', path: '/admin' }] : []),
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'py-4' : 'py-6'
    }`}>
      <div className="container">
        <div className={`relative flex items-center justify-between p-2 pl-6 pr-2 rounded-[22px] transition-all duration-500 border ${
          isScrolled 
            ? 'bg-white/80 backdrop-blur-md border-zinc-200 shadow-lg' 
            : 'bg-transparent border-transparent'
        }`}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center shadow-md shadow-teal-600/20 group-hover:scale-110 transition-transform duration-500">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter text-zinc-950 leading-none">SmartQueue</span>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-teal-600">Enterprise</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 ml-12 mr-auto">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all no-underline ${
                  location.pathname === link.path 
                    ? 'bg-teal-50 text-teal-700 border border-teal-100' 
                    : 'text-slate-500 hover:text-zinc-950 hover:bg-slate-50'
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
                <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-50 border border-zinc-100 mr-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Wallet</span>
                  <Link to="/wallet" className="text-sm font-black text-teal-700 hover:scale-105 transition-transform">
                    ₹{(user.walletBalance ?? 0).toLocaleString()}
                  </Link>
                </div>

                <div className="flex items-center gap-2 pr-1">
                  <Link to="/profile" className="flex items-center gap-3 p-1 rounded-2xl bg-slate-50 border border-zinc-100 hover:border-zinc-200 transition-all no-underline group pr-4">
                    <div className="relative">
                      {user.avatar ? (
                        <img src={user.avatar} className="w-9 h-9 rounded-xl object-cover border border-zinc-200" alt="Avatar" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white bg-teal-600">
                          {user.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                      {connected && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />}
                    </div>
                    <div className="hidden sm:flex flex-col">
                      <span className="text-xs font-bold text-zinc-950 leading-tight">{user.name?.split(' ')[0]}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user.role}</span>
                    </div>
                  </Link>

                  <button 
                    onClick={handleLogout}
                    className="p-3 rounded-2xl bg-slate-50 border border-zinc-100 text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all active:scale-95"
                    title="Logout"
                  >
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <Link to="/login" className="btn-primary">
                Get Started
              </Link>
            )}

            {/* Mobile Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-3 rounded-xl bg-slate-50 text-slate-500 border border-zinc-100"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden container mt-2 overflow-hidden"
          >
            <div className="bg-white border border-zinc-200 p-6 rounded-[22px] shadow-2xl space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-4 text-sm font-bold border-b border-zinc-50 text-slate-500 no-underline"
                >
                  {link.name}
                </Link>
              ))}
              {user && (
                <div className="pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-zinc-950">Wallet</span>
                    <span className="text-teal-700 font-black">₹{user.walletBalance}</span>
                  </div>
                  <button onClick={handleLogout} className="text-rose-600 font-black uppercase text-[10px] tracking-widest">Logout</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
