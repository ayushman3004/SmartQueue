import { ArrowRight, Mail, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { guidePages } from '../seo/publicPages'
import './Footer.css'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  return <footer className="site-footer">
    <div className="site-footer-body">
      <div className="site-footer-brand"><Link to="/" aria-label="serveQ home"><img src="/serveq-logo.png" alt="serveQ" width="220" height="76" /></Link><p>A little less waiting.<br />A little more living.</p></div>
      <div className="site-footer-columns">
        <section className="site-footer-mobile" aria-labelledby="footer-mobile-title"><h2 id="footer-mobile-title">Take your place, on your phone.</h2><Link to="/customers" className="site-footer-qr" aria-label="Open serveQ customer portal"><img src="/serveq-qr.png" alt="Scan to open the serveQ customer portal on your phone" width="156" height="156" loading="lazy" /></Link><p>Scan to find a clinic or salon.<br />No app download needed.</p><Link to="/customers" className="site-footer-inline">Get started <ArrowRight size={16} /></Link></section>
        <nav aria-labelledby="footer-explore-title"><h2 id="footer-explore-title">Explore serveQ</h2><ul><li><Link to="/customers">Find a clinic or salon</Link></li><li><Link to="/business">For businesses</Link></li><li><Link to="/subscription">Business plans</Link></li><li><Link to="/login">Sign in</Link></li><li><Link to="/profile">My account</Link></li></ul></nav>
        <nav aria-labelledby="footer-guides-title"><h2 id="footer-guides-title">Good to know</h2><ul>{guidePages.map((page) => <li key={page.path}><Link to={page.path}>{({ '/how-it-works': 'How serveQ works', '/virtual-queue': 'Understanding virtual queues', '/for-clinics': 'serveQ for clinics', '/for-salons': 'serveQ for salons' })[page.path] || page.title}</Link></li>)}<li><Link to="/privacy">Privacy policy</Link></li><li><Link to="/terms">Terms & conditions</Link></li></ul></nav>
        <section className="site-footer-contact" aria-labelledby="footer-contact-title"><h2 id="footer-contact-title">Let’s talk</h2><p>Questions about your visit<br />or running your business?</p><a href="mailto:support@serveq.tech" className="site-footer-email">support@serveq.tech</a><Link to="/support" className="site-footer-help">Get help <ArrowRight size={16} /></Link><div className="site-footer-contact-icons"><a href="mailto:support@serveq.tech" aria-label="Email serveQ support"><Mail size={21} strokeWidth={1.5} /></a><Link to="/support" aria-label="Open help and support"><MessageCircle size={21} strokeWidth={1.5} /></Link></div></section>
      </div>
      <div className="site-footer-bottom"><p>© {currentYear} ServeQ Technologies. All rights reserved.</p><span>Made for waitless living.</span><button type="button" onClick={() => { window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }}>Back to top ↑</button></div>
    </div>
  </footer>
}
