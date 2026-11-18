import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { checkoutSubscription, getPendingSubscription, verifyPendingSubscription } from '../utils/subscriptionCheckout'

export default function useSubscriptionCheckout(onSuccess) {
  const { user, setUser } = useAuth()
  const locked = useRef(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(() => getPendingSubscription(user))
  const run = async (plan) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setSelectedPlan(plan?.id || null)
    setError('')
    try {
      setStage('Verifying payment…')
      const result = plan ? await checkoutSubscription(plan, user, setStage) : await verifyPendingSubscription(user)
      setUser((prev) => prev ? { ...prev, subscription: result.subscription } : prev)
      await onSuccess?.(result)
    } catch (err) {
      setError(err.code === 'ECONNABORTED' ? 'The payment server took too long to respond. Please retry; if a payment was already made, use Retry verification.' : err.response?.data?.message || err.message || 'Unable to complete subscription.')
    } finally {
      setPending(getPendingSubscription(user))
      setBusy(false)
      setStage('')
      locked.current = false
    }
  }
  return { busy, stage, error, pending, selectedPlan, subscribe: (plan) => run(plan), retry: () => run() }
}
