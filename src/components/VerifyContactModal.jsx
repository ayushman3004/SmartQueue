import { useEffect, useRef, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { useDialog } from '../hooks/useDialog'
import { confirmFirebasePhone } from '../api/auth.api.js'
import { confirmFirebasePhoneOtp, isFirebaseConfigured, sendFirebasePhoneOtp } from '../lib/firebase.js'

const errors = {
  'auth/captcha-check-failed': 'The security check failed. Request another code.',
  'auth/code-expired': 'This code expired. Request another code.',
  'auth/invalid-verification-code': 'That code is incorrect. Try again.',
  'auth/too-many-requests': 'Too many requests. Wait a few minutes and try again.',
}

export default function VerifyContactModal({ onClose, value, onSuccess }) {
  const [otp, setOtp] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [proof, setProof] = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const recaptcha = useRef(null)
  const busy = Boolean(pending)
  const close = () => { if (!busy) onClose() }
  const dialog = useDialog(true, close, false, target => pending === 'send' &&
    Boolean(target?.matches?.('iframe[src*="/recaptcha/"]')))

  useEffect(() => {
    if (!cooldown) return
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function sendCode() {
    setPending('send')
    setError('')
    try {
      const result = await sendFirebasePhoneOtp(value, recaptcha.current)
      setConfirmation(result)
      setOtp('')
      setProof(null)
      setCooldown(30)
    } catch (failure) {
      setError(errors[failure.code] || 'Could not send an SMS. Check the number and try again.')
    } finally {
      setPending('')
    }
  }

  async function verify(event) {
    event.preventDefault()
    if (busy || !confirmation || otp.length !== 6) return
    setPending('verify')
    setError('')
    try {
      const token = proof || await confirmFirebasePhoneOtp(confirmation, otp)
      setProof(token)
      const response = await confirmFirebasePhone(value, token)
      onSuccess(response.data.data.user)
    } catch (failure) {
      if (failure.response?.status === 401) {
        setConfirmation(null)
        setProof(null)
        setOtp('')
      }
      setError(failure.response?.data?.message || errors[failure.code] || 'Could not verify your phone. Try again.')
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
        <h2 id="verify-phone-heading" className="text-xl font-bold">Verify your phone</h2>
        <p className="text-sm text-slate-600">
          {confirmation ? 'Enter the six-digit code sent to' : 'Send a verification code by SMS to'} <strong>{value}</strong>.
        </p>
      </header>
      {isFirebaseConfigured && !confirmation && <p className="text-xs text-slate-600">Firebase sends the SMS. Standard messaging rates may apply.</p>}
      {!isFirebaseConfigured && <p role="status" className="text-sm text-slate-600">Phone verification is temporarily unavailable.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <form onSubmit={verify} className="space-y-4" aria-busy={busy}>
        {confirmation && <>
          <label className="block text-sm font-medium">
            Verification code
            <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={otp} disabled={busy || Boolean(proof)} onChange={event => setOtp(event.target.value.replace(/\D/g, ''))}
              className="mt-2 block w-full rounded-xl border border-zinc-300 px-4 py-3 text-lg" />
          </label>
          <button type="submit" disabled={busy || otp.length !== 6}
            className="w-full rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {pending === 'verify' ? 'Verifying…' : 'Verify phone'}
          </button>
        </>}
        <button type="button" disabled={busy || cooldown > 0 || !isFirebaseConfigured} onClick={sendCode}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold disabled:opacity-50">
          {pending === 'send' ? 'Sending…' : cooldown ? `Send again in ${cooldown}s` : confirmation ? 'Send another code' : 'Send code'}
        </button>
        <div ref={recaptcha} />
      </form>
    </section>
  </div>
}
