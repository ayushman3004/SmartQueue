import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/legal-pages.css'

export default function LegalPageLayout({ title, label, updated, children }) {
  const { user } = useAuth()
  const dashboardPath = user?.role === 'owner' ? '/hub/dashboard' : user?.role === 'admin' ? '/admin' : '/customers'

  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link to="/" aria-label="serveQ home" className="legal-brand">
            <img src="/serveq-logo.png" alt="serveQ" width="110" height="38" />
          </Link>
          <nav aria-label="Main navigation">
            <Link to="/">Home</Link>
            <Link className="legal-header-action" to={user ? dashboardPath : '/login'}>
              {user ? 'Dashboard' : 'Sign in'}
            </Link>
          </nav>
        </div>
      </header>
      <div className="legal-document">
        <div className="legal-hero">
          <p className="legal-eyebrow">{label}</p>
          <h1>{title}</h1>
          <p className="legal-updated">{updated}</p>
        </div>
        <nav className="legal-tabs" aria-label="Legal documents">
          <NavLink to="/terms">Terms & conditions</NavLink>
          <NavLink to="/privacy">Privacy policy</NavLink>
        </nav>
        <article className="legal-content" aria-label={title}>{children}</article>
        <div className="legal-help">
          <p>Have a question?</p>
          <Link to="/support">Get in touch with our team <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </div>
  )
}
