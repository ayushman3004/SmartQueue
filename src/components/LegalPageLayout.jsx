import { Link, NavLink } from 'react-router-dom'
import PublicNavbar from './PublicNavbar'
import '../styles/legal-pages.css'

export default function LegalPageLayout({ title, label, updated, children }) {
  return (
    <div className="legal-page">
      <PublicNavbar />
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
