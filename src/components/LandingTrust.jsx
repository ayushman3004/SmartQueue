import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import './LandingTrust.css'

export default function LandingTrust() {
  return <section id="security" className="landing-trust" aria-labelledby="landing-trust-title"><div className="max-w-6xl mx-auto px-4 sm:px-6">
    <header className="landing-details-heading"><p>SECURITY & TRUST</p><h2 id="landing-trust-title">Clear access. Careful handling.</h2><p>Your visits and business operations need more than a convenient queue. Here’s how account access and information are handled.</p></header>
    <div className="landing-trust-grid">
      <article><span className="landing-trust-icon"><KeyRound size={23} strokeWidth={1.5} /></span><h3>Protected account access</h3><p>Passwords are stored as hashes rather than readable text. Protected account actions require a valid signed-in session.</p></article>
      <article><span className="landing-trust-icon"><LockKeyhole size={23} strokeWidth={1.5} /></span><h3>Permissions match the role</h3><p>Customer, owner, and administrator accounts have different access. Business management checks ownership, and administrator endpoints require an admin role.</p><p className="landing-trust-detail">Adding a staff member to a roster does not create a separate staff login or a custom permission role.</p></article>
      <article><span className="landing-trust-icon"><ShieldCheck size={23} strokeWidth={1.5} /></span><h3>Information with a purpose</h3><p>Contact, location, booking, and service information supports your visits and business operations. Payment providers process online payments; serveQ records payment references and status.</p></article>
    </div>
    <div className="landing-trust-bottom"><p>Read what information is collected, how it is used and shared, and how to contact us about your privacy.</p><Link to="/privacy">Read our privacy policy <ArrowRight size={16} /></Link></div>
  </div></section>
}

