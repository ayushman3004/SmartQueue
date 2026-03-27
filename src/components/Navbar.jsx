import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { logout } from '../api/auth.api'
import { useSocket } from '../context/SocketContext'

export default function Navbar() {
  const { user, logOut } = useAuth()
  const { connected } = useSocket()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout().catch(() => {})
    logOut()
    navigate('/login')
  }

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'rgba(8, 11, 15, 0.85)',
        backdropFilter: 'blur(20px)',
        borderColor: 'var(--border)'
      }}
    >
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
            style={{ background: 'linear-gradient(135deg, var(--cyan), #7B61FF)' }}
          >
            Q
          </div>
          <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Smart<span className="gradient-text">Queue</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Live indicator */}
          {user && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: connected ? 'var(--green-dim)' : 'rgba(255,82,82,0.1)', border: `1px solid ${connected ? 'rgba(0,230,118,0.3)' : 'rgba(255,82,82,0.3)'}` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: connected ? 'var(--green)' : 'var(--red)', animation: connected ? 'pulse-dot 1.5s infinite' : 'none' }} />
              <span className="text-xs font-semibold" style={{ color: connected ? 'var(--green)' : 'var(--red)' }}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                {user.avatar ? (
                  <img src={user.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black"
                    style={{ background: 'linear-gradient(135deg, var(--cyan), #7B61FF)' }}>
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight" style={{ color: 'var(--text-secondary)' }}>
                    {user.name?.split(' ')[0]}
                  </span>
                  <span className="text-[10px] font-semibold leading-tight" style={{
                    color: user.role === 'owner' ? '#7B61FF' : 'var(--cyan)'
                  }}>
                    {user.role === 'owner' ? 'Owner' : 'Customer'}
                  </span>
                </div>
              </div>
              <button onClick={handleLogout} className="btn-secondary text-sm py-2 px-4">
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-primary text-sm py-2 px-5">Sign In</Link>
          )}
        </div>
      </div>
    </motion.nav>
  )
}
