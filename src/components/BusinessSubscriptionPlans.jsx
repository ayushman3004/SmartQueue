import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { getCurrentSubscription } from '../api/subscription.api'
import { useAuth } from '../context/AuthContext'
import { hasActiveSubscription } from '../utils/subscription'
import useSubscriptionCheckout from '../hooks/useSubscriptionCheckout'
import BusinessSubscriptionCoupon from './BusinessSubscriptionCoupon'

export default function BusinessSubscriptionPlans({ onSuccess, onBusyChange }) {
  const { user, setUser } = useAuth()
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [couponBusy, setCouponBusy] = useState(false)
  const checkout = useSubscriptionCheckout(onSuccess)
  const feedback = useRef(null)
  useEffect(() => {
    if (checkout.busy || checkout.error) feedback.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  }, [checkout.busy, checkout.error])
  const load = useCallback(() => {
    getCurrentSubscription().then(({ data }) => {
      setCatalog(data.data.availablePlans)
      setUser((prev) => prev ? { ...prev, subscription: data.data.subscription } : prev)
    }).catch((err) => setError(err.response?.data?.message || 'Unable to load plans. Please retry.')).finally(() => setLoading(false))
  }, [setUser])
  useEffect(() => { load() }, [load])
  useEffect(() => { onBusyChange?.(checkout.busy || couponBusy) }, [checkout.busy, couponBusy, onBusyChange])
  const active = hasActiveSubscription(user?.subscription)
  if (user?.role === 'admin') return <div className="business-plan-notice">
    <strong>Super admin · Pro included</strong>
    <p className="mt-2 text-sm leading-relaxed">All Pro features are available for your administrator account and test venues. No payment or renewal is required.</p>
  </div>
  return <div className="business-plans space-y-6">
    <div ref={feedback} className="business-checkout-feedback" aria-live="polite">
      {checkout.busy && <p role="status">{checkout.stage}</p>}
      {checkout.error && <div role="alert"><strong>Checkout could not complete</strong><p>{checkout.error}</p></div>}
    </div>
    {loading ? <p role="status" className="py-8 text-sm text-zinc-500">Loading your subscription…</p> : error ? <div role="alert" className="business-plan-notice"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(''); load() }} className="mt-3 text-sm font-semibold underline">Retry loading plans</button></div> : <>
      {active && <div className="business-plan-notice"><strong>{catalog?.[user.subscription.plan]?.name} is active</strong><p className="mt-1 text-sm">Valid until {user.subscription.expiresAt ? new Date(user.subscription.expiresAt).toLocaleDateString('en-IN') : 'your current period ends'}. Renewal adds 30 days to your remaining time.</p></div>}
      {checkout.pending && <div className="business-plan-notice" role="status"><strong>Your payment needs verification.</strong><p className="my-2 text-sm">Retry activation here. You will not be charged again.</p><button type="button" disabled={checkout.busy} onClick={checkout.retry} className="business-primary inline-flex items-center gap-2"><RefreshCw size={15} />Retry verification</button></div>}
      <BusinessSubscriptionCoupon disabled={active || checkout.busy || Boolean(checkout.pending)} onSuccess={onSuccess} onBusyChange={setCouponBusy} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{Object.values(catalog || {}).map((plan) => {
        const current = active && user.subscription.plan === plan.id
        const downgrade = active && user.subscription.plan === 'PRO' && plan.id === 'BASIC'
        return <section key={plan.id} className="business-plan-card">
          <div className="flex justify-between items-start gap-3"><h2>{plan.name}</h2><span className="business-plan-badge">{current ? 'Current plan' : plan.id === 'PRO' ? 'More room to grow' : 'The essentials'}</span></div>
          <p className="business-plan-price">₹{plan.price.toLocaleString('en-IN')} <span>/ month</span></p>
          <p className="text-sm leading-relaxed text-zinc-600">{plan.tagline}</p>
          <ul className="my-6 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm leading-relaxed"><Check size={16} className="mt-1 shrink-0" /><span>{feature}</span></li>)}</ul>
          {plan.plannedFeatures?.length > 0 && <div className="mb-6 text-xs text-zinc-600"><p className="font-semibold">Planned features</p><ul className="mt-2 list-disc space-y-1 pl-4">{plan.plannedFeatures.map(feature => <li key={feature}>{feature}</li>)}</ul></div>}
          <button type="button" disabled={couponBusy || checkout.busy || Boolean(checkout.pending) || downgrade} onClick={() => checkout.subscribe(plan)} className="business-primary mt-auto w-full">{checkout.busy && checkout.selectedPlan === plan.id ? checkout.stage : downgrade ? 'Available after Pro expires' : current ? 'Renew for 30 days' : active ? 'Upgrade to Pro' : `Choose ${plan.name}`}</button>
        </section>
      })}</div>
      <p className="text-xs text-zinc-500 leading-relaxed">Each month covers 30 days. One-time payment for each period. No automatic renewal. A Pro upgrade starts a new 30-day period at full price; unused Basic time is not credited.</p>
    </>}
  </div>
}
