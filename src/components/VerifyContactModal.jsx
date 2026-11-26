import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { useDialog } from '../hooks/useDialog'
import { sendWhatsAppPhoneOtp, verifyWhatsAppPhoneOtp, sendPhoneSignInOtp, verifyPhoneSignInOtp } from '../api/auth.api.js'
import TurnstileWidget from './TurnstileWidget.jsx'
import { normalizePhoneNumber } from '../utils/phoneNumbers.js'

const countryCodes = [['+91', 'India'], ['+1', 'US / Canada'], ['+44', 'United Kingdom'], ['+61', 'Australia'], ['+971', 'UAE']]
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
const digits = value => value.replace(/\D/g, '').slice(0, 6)

export default function VerifyContactModal({ onClose, value, onSuccess, signIn = false }) {
  const normalized = normalizePhoneNumber(value)
  const [country, setCountry] = useState(() => normalized ? countryCodes.find(([code]) => normalized.startsWith(code))?.[0] || '' : '+91')
  const [number, setNumber] = useState(() => normalized ? normalized.slice(country.length) : value || '')
  const phone = normalizePhoneNumber(number.trim().startsWith('+') ? number : country + number)
  const [otp, setOtp] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const [token, setToken] = useState(null)
  const [widget, setWidget] = useState(0)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const busy = Boolean(pending)
  const close = () => { if (!busy) onClose() }
  const dialog = useDialog(true, close, false, target =>
    Boolean(target?.matches?.('iframe[src*="challenges.cloudflare.com"]')))

  useEffect(() => {
    if (!cooldown) return
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function sendCode() {
    if (!phone || !token || busy || cooldown) return
    setPending('send')
    setError('')
    try {
      const send = signIn ? sendPhoneSignInOtp : sendWhatsAppPhoneOtp
      const { data } = await send(phone, token)
      setChallenge(data.data)
      setOtp('')
      setCooldown(data.data.resendAfterSeconds)
    } catch (failure) {
      const retry = Number(failure.response?.headers?.['retry-after'])
      if (Number.isFinite(retry) && retry > 0) setCooldown(retry)
      setError(failure.response?.data?.message || 'Could not request a code. Try again shortly.')
    } finally {
      setToken(null)
      setWidget(value => value + 1)
      setPending('')
    }
  }

  async function verify(event) {
    event.preventDefault()
    if (busy || !challenge || otp.length !== 6) return
    setPending('verify')
    setError('')
    try {
      const verifyOtp = signIn ? verifyPhoneSignInOtp : verifyWhatsAppPhoneOtp
      const { data } = await verifyOtp({ phone, otp, challengeId: challenge.challengeId, purpose: challenge.purpose })
      onSuccess(data.data.user)
    } catch (failure) {
      setOtp('')
      setError(failure.response?.data?.message || 'Could not verify your phone. Try again.')
    } finally {
      setPending('')
    }
  }

  return <div className="app-modal-layer fixed inset-0 z-50 flex items-center justify-center p-4">
    <div onClick={close} className="fixed inset-0 bg-slate-950/60 backdrop-blur-md" />
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="verify-phone-heading"
      className="app-dialog business-page verification-dialog relative z-10 w-full max-w-md space-y-5 rounded-3xl border border-zinc-200 bg-white p-7 shadow-2xl">
      <button type="button" onClick={close} disabled={busy} aria-label="Close"
        className="absolute right-5 top-5 rounded-full bg-slate-100 p-2 text-slate-700 disabled:opacity-50"><X size={16} /></button>
      <header className="space-y-2">
        <Smartphone className="text-teal-700" size={24} aria-hidden="true" />
        <h2 id="verify-phone-heading" className="text-xl font-bold">{signIn ? 'Sign in with your phone' : 'Verify your phone on WhatsApp'}</h2>
        <p className="text-sm text-slate-600">
          {challenge && (signIn ? <>If this number is linked to an account, a six-digit code will arrive on WhatsApp at <strong>{phone}</strong>.</>
            : <>Enter the six-digit code sent to <strong>{phone}</strong>.</>)}
          {!challenge && (signIn ? 'Use the mobile number you gave at the clinic.' : 'Enter the mobile number you use on WhatsApp.')}
        </p>
      </header>
      {!siteKey && <p role="status" className="text-sm text-slate-600">Phone verification is temporarily unavailable.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <form onSubmit={verify} className="space-y-4" aria-busy={busy}>
        {!challenge && <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2">
          <label className="text-sm font-medium">Country code
            <select value={country} onChange={event => setCountry(event.target.value)} disabled={busy}
              className="mt-2 block w-full rounded-xl border border-zinc-300 px-3 py-3">
              {countryCodes.map(([code, label]) => <option key={code} value={code}>{label} ({code})</option>)}
              <option value="">Other country</option>
            </select>
          </label>
          <label className="text-sm font-medium">Mobile number
            <input type="tel" autoComplete="tel" value={number} onChange={event => setNumber(event.target.value)}
              disabled={busy} placeholder={country || '+ country code'} maxLength={30}
              className="mt-2 block w-full rounded-xl border border-zinc-300 px-3 py-3" />
          </label>
        </div>}
        {challenge && <>
          <label className="block text-sm font-medium">
            Verification code
            <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={otp} disabled={busy} onChange={event => setOtp(digits(event.target.value))}
              onPaste={event => { event.preventDefault(); setOtp(digits(event.clipboardData.getData('text'))) }}
              className="mt-2 block w-full rounded-xl border border-zinc-300 px-4 py-3 text-lg" />
          </label>
          <button type="submit" disabled={busy || otp.length !== 6}
            className="w-full rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {pending === 'verify' ? 'Verifying…' : signIn ? 'Sign in' : 'Verify phone'}
          </button>
          <button type="button" disabled={busy} className="text-sm underline" onClick={() => {
            setChallenge(null)
            setOtp('')
            setError('')
          }}>Use a different number</button>
        </>}
        {cooldown === 0 && <TurnstileWidget action="whatsapp_phone_otp" onToken={setToken} key={widget} />}
        <button type="button" disabled={busy || cooldown > 0 || !phone || !token} onClick={sendCode}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold disabled:opacity-50">
          {pending === 'send' ? 'Sending…' : cooldown ? `Send again in ${cooldown}s` : challenge ? 'Send another WhatsApp code' : 'Send WhatsApp code'}
        </button>
        <p className="text-xs text-slate-600">Without WhatsApp, you can still sign in using email or Google and view your prescriptions in ServeQ.</p>
      </form>
    </section>
  </div>
}
