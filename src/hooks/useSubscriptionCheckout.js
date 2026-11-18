import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { checkoutSubscription, getPendingSubscription, verifyPendingSubscription } from '../utils/subscriptionCheckout'

export default function useSubscriptionCheckout(onSuccess) {
  const { user, setUser } = useAuth()
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(() => getPendingSubscription(user))
  const run = async (plan) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      setStage('Verifying payment…')
      const result = plan ? await checkoutSubscription(plan, user, setStage) : await verifyPendingSubscription(user)
      setUser((prev) => prev ? { ...prev, subscription: result.subscription } : prev)
      await onSuccess?.(result)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to complete subscription.')
    } finally {
      setPending(getPendingSubscription(user))
      setBusy(false)
      setStage('')
      locked.current = false
    }
  }
  return { busy, stage, error, pending, subscribe: (plan) => run(plan), retry: () => run() }
}
