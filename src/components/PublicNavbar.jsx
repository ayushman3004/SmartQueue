import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowRight, Play, Menu, X } from 'lucide-react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import WebsiteTour from './WebsiteTour'
import './PublicNavbar.css'

export default function PublicNavbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'
  const { user } = useAuth()
  const dashboardPath = user?.role === 'owner' ? '/hub/dashboard' : user?.role === 'admin' ? '/admin' : '/customers'
  const menuToggleRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [tourTrigger, setTourTrigger] = useState(() => isHome && location.hash === '#take-tour' ? 1 : 0)
  const startTour = () => {
    if (isHome) setTourTrigger((count) => count + 1)
    else navigate('/#take-tour')
  }

  useEffect(() => {
    if (!mobileMenuOpen) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        menuToggleRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  return <>
      <header className="public-navbar">
        <div className="landing-header-bar">
          <Link to="/" className="landing-header-brand" aria-label="serveQ home">
            <img src="/serveq-logo.png" alt="serveQ" width="110" height="38" />
          </Link>

          <nav id="tour-header-nav" className="landing-header-nav" aria-label="Main navigation">
            <a href={isHome ? '#how-it-works' : '/#how-it-works'}>How it works</a>
            <NavLink to="/about" onClick={() => setMobileMenuOpen(false)}>About us</NavLink>
            <a href={isHome ? '#problem-solution' : '/#problem-solution'}>Why serveQ</a>
            <a href={isHome ? '#security' : '/#security'}>Trust</a>
          </nav>

          <div className="landing-header-actions">
            <button type="button" className="landing-tour-button" onClick={startTour}>
              <Play size={13} aria-hidden="true" /> Take a tour
            </button>
            <span className="landing-header-divider" aria-hidden="true" />
            <Link to="/business" className="landing-business-link">For business</Link>
            <Link to={user ? dashboardPath : '/login'} className="landing-sign-in">{user ? 'Dashboard' : 'Sign in'}</Link>
            <button type="button" onClick={() => navigate('/login')} id="tour-join-queue-btn" className="landing-start-button">
              Get started <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button
              id="tour-mobile-nav-btn"
              ref={menuToggleRef}
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="landing-menu-toggle"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="landing-mobile-navigation"
            >
              {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              id="landing-mobile-navigation"
              aria-label="Mobile navigation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
              className="landing-mobile-navigation"
            >
              <p>Explore serveQ</p>
              <a href={isHome ? '#how-it-works' : '/#how-it-works'} onClick={() => setMobileMenuOpen(false)}>How it works <ArrowRight size={16} aria-hidden="true" /></a>
              <Link to="/about" onClick={() => setMobileMenuOpen(false)}>About us <ArrowRight size={16} aria-hidden="true" /></Link>
              <a href={isHome ? '#problem-solution' : '/#problem-solution'} onClick={() => setMobileMenuOpen(false)}>Why serveQ <ArrowRight size={16} aria-hidden="true" /></a>
              <a href={isHome ? '#security' : '/#security'} onClick={() => setMobileMenuOpen(false)}>Security & trust <ArrowRight size={16} aria-hidden="true" /></a>
              <div className="landing-mobile-actions">
                <button type="button" onClick={() => { setMobileMenuOpen(false); startTour() }}><Play size={14} aria-hidden="true" /> Take a tour</button>
                <Link to="/business" onClick={() => setMobileMenuOpen(false)}>For business <ArrowRight size={16} aria-hidden="true" /></Link>
                <Link to={user ? dashboardPath : '/login'} onClick={() => setMobileMenuOpen(false)}>{user ? 'Dashboard' : 'Sign in'} <ArrowRight size={16} aria-hidden="true" /></Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

    {isHome && <WebsiteTour manualTrigger={tourTrigger} />}
  </>
}
