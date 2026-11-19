import { useState } from 'react'
import { redeemSubscriptionCoupon } from '../api/subscription.api'
import { useAuth } from '../context/AuthContext'

export default function BusinessSubscriptionCoupon({ disabled, onSuccess, onBusyChange }) {
  const { setUser } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const redeem = async event => {
    event.preventDefault()
    setBusy(true); onBusyChange?.(true); setError(''); setSuccess('')
    try {
      const { data } = await redeemSubscriptionCoupon(code.trim())
      const result = data.data
      setUser(result.user)
      setCode('')
      setSuccess(`Pro is active for ${result.businessName} until ${new Date(result.subscription.expiresAt).toLocaleDateString('en-IN')}. Amount paid: ₹0.`)
      onSuccess?.(result)
    } catch (err) { setError(err.response?.data?.message || 'Activation could not complete. Refresh your subscription before retrying.') }
    finally { setBusy(false); onBusyChange?.(false) }
  }
  return <section className="business-plan-notice space-y-3" aria-labelledby="subscription-coupon-heading">
    <h2 id="subscription-coupon-heading" className="text-base font-semibold">Have a free Pro coupon?</h2>
    <p className="text-sm text-zinc-600">Enter the code ServeQ emailed to your business to activate Pro for 30 days. No payment required. Each business coupon can be activated once.</p>
    <form onSubmit={redeem} className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1 min-w-0"><label htmlFor="business-subscription-coupon" className="block text-xs font-semibold mb-1">Business coupon code</label><input id="business-subscription-coupon" name="couponCode" type="text" value={code} onChange={event => setCode(event.target.value.toUpperCase())} maxLength={64} autoCapitalize="characters" autoComplete="off" spellCheck={false} required disabled={busy || disabled} placeholder="YOUR-BUSINESS-PRO-…" className="w-full min-w-0 min-h-11 px-3 py-2 rounded-xl border border-zinc-300 bg-white text-base focus:outline-2 focus:outline-emerald-800 disabled:opacity-60" /></div>
      <button type="submit" disabled={busy || disabled || !code.trim()} className="business-primary min-h-11 sm:self-end disabled:opacity-50">{busy ? 'Activating Pro…' : 'Activate free Pro month'}</button>
    </form>
    {disabled && <p className="text-xs text-zinc-600">Finish any pending payment verification first, or redeem after your current subscription expires.</p>}
    {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
    {success && <p role="status" className="text-sm text-emerald-900">{success}</p>}
  </section>
}
