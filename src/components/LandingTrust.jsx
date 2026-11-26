import { ArrowRight, LockKeyhole, MessageCircle, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import './LandingTrust.css'

export default function LandingTrust() {
  return <section id="security" className="landing-trust" aria-labelledby="landing-trust-title"><div className="max-w-6xl mx-auto px-4 sm:px-6">
    <header className="landing-details-heading"><h2 id="landing-trust-title">Privacy and access controls</h2></header>
    <div className="landing-trust-grid">
      <article><span className="landing-trust-icon"><LockKeyhole size={23} strokeWidth={1.5} aria-hidden="true" /></span><h3>Private prescriptions</h3><p>ServeQ encrypts clinical details when prescriptions are saved. Patients and their prescribing doctors sign in to access the prescription.</p></article>
      <article><span className="landing-trust-icon"><ShieldCheck size={23} strokeWidth={1.5} aria-hidden="true" /></span><h3>Access matches the role</h3><p>Clinic teams manage operations for their own clinics. Doctors see the patients assigned to them and the prescriptions they issue.</p></article>
      <article><span className="landing-trust-icon"><MessageCircle size={23} strokeWidth={1.5} aria-hidden="true" /></span><h3>WhatsApp is optional</h3><p>Where supported, patients can choose whether to receive WhatsApp notices. Messages are generic and clinical details stay in ServeQ.</p></article>
    </div>
    <div className="landing-trust-bottom"><p>Read what information is collected, how it is used and shared, and how to contact us about your privacy.</p><Link to="/privacy">Read our privacy policy <ArrowRight size={16} /></Link></div>
  </div></section>
}

