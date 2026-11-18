import { useEffect, useRef } from 'react'
import { ArrowRight, Check, Loader2, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import BusinessSetupProgress from './BusinessSetupProgress'
import './BusinessEmailVerification.css'

export default function BusinessEmailVerification({ email, sent, code, onCodeChange, onSend, onVerify, sending, verifying, cooldown, onSignOut }) {
  const codeInput = useRef(null)
  useEffect(() => { if (sent) codeInput.current?.focus() }, [sent])
  const busy = sending || verifying
  return <div className="business-email-screen app-background-glow">
    <header className="business-email-header"><Link to="/" aria-label="serveQ home"><img src="/serveq-logo.png" alt="serveQ" /></Link><button type="button" onClick={onSignOut}>Sign out</button></header>
    <main className="business-email-main">
      <BusinessSetupProgress current={1} />
      <section className="business-email-card" aria-labelledby="business-email-title">
        <span className="business-email-emblem" aria-hidden="true"><Mail size={29} strokeWidth={1.4} /></span>
        <p className="business-email-eyebrow">LET’S MAKE IT OFFICIAL</p>
        <h1 id="business-email-title">{sent ? 'Check your inbox.' : 'Your business starts here.'}</h1>
        <p className="business-email-intro">{sent ? 'Enter the six-digit code we sent to your email.' : 'First, let’s check your email. We’ll send you a six-digit code to confirm it’s yours.'}</p>
        <div className="business-email-address"><Mail size={15} strokeWidth={1.5} /><span>{email}</span></div>
        {sent ? <form onSubmit={onVerify} className="business-email-form">
          <label htmlFor="business-email-code">Verification code</label>
          <input ref={codeInput} id="business-email-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" aria-describedby="business-email-code-help" disabled={verifying} />
          <p id="business-email-code-help">Can’t find it? Check your spam or junk folder.</p>
          <button type="submit" disabled={busy || code.length !== 6} className="business-email-primary">{verifying ? <><Loader2 size={16} className="animate-spin" />Verifying…</> : <><Check size={16} />Verify & choose a plan</>}</button>
          <div className="business-email-resend">{cooldown > 0 ? <span role="status">Send a new code in {cooldown}s</span> : <button type="button" disabled={busy} onClick={onSend}>{sending ? 'Sending…' : 'Resend code'}</button>}</div>
        </form> : <div className="business-email-send"><button type="button" disabled={busy} onClick={onSend} className="business-email-primary">{sending ? <><Loader2 size={16} className="animate-spin" />Sending your code…</> : <>Send verification code<ArrowRight size={16} /></>}</button><p>No payment yet. Verify your email, then choose your plan.</p></div>}
        <div className="business-email-next"><span>UP NEXT</span><p>Choose a plan <ArrowRight size={12} /> Set up your business</p></div>
        <div className="business-email-links"><Link to="/profile">Change email</Link><span aria-hidden="true">·</span><Link to="/support">Need a hand?</Link></div>
      </section>
      <p className="business-email-footnote">A little less waiting. A little more living.</p>
    </main>
  </div>
}
