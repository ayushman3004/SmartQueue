import { createSubscriptionOrder, verifySubscriptionPayment } from '../api/subscription.api'
let scriptPromise
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    document.getElementById('razorpay-checkout-js')?.remove()
    const script = document.createElement('script')
    script.id = 'razorpay-checkout-js'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    const timer = setTimeout(() => { script.remove(); reject(new Error('Checkout timed out. Please try again.')) }, 20000)
    script.onload = () => { clearTimeout(timer); window.Razorpay ? resolve() : reject(new Error('Checkout could not load. Please try again.')) }
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Checkout could not load. Check your connection.')) }
    document.body.appendChild(script)
  }).catch((error) => { scriptPromise = null; throw error })
  return scriptPromise
}
export const pendingSubscriptionKey = (user) => `subscription-payment:${user?._id || user?.id}`
export function getPendingSubscription(user) {
  try { return JSON.parse(sessionStorage.getItem(pendingSubscriptionKey(user))) } catch { return null }
}
export async function verifyPendingSubscription(user) {
  const pending = getPendingSubscription(user)
  if (!pending) throw new Error('No pending payment to verify.')
  const response = await verifySubscriptionPayment(pending)
  sessionStorage.removeItem(pendingSubscriptionKey(user))
  return response.data.data
}
export async function checkoutSubscription(plan, user, onStage) {
  if (getPendingSubscription(user)) throw new Error('Verify your previous payment before starting another checkout.')
  onStage('Preparing checkout…')
  await loadCheckout()
  const { data: response } = await createSubscriptionOrder(plan.id)
  const { order, keyId } = response.data
  if (!order?.id || order.isMock || order.id.startsWith('order_mock_') || !keyId || !Number.isInteger(order.amount)) {
    throw new Error('Subscription checkout is unavailable. Please contact support.')
  }
  onStage('Complete payment in Razorpay…')
  const payment = await new Promise((resolve, reject) => {
    let completed = false
    const checkout = new window.Razorpay({
      key: keyId, order_id: order.id, amount: order.amount, currency: order.currency,
      name: 'serveQ', description: `${plan.name} · 30 days`, image: '/serveq-logo.png',
      prefill: { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
      theme: { color: '#315b45' },
      handler: (result) => { completed = true; resolve(result) },
      modal: { ondismiss: () => { if (!completed) { const error = new Error('Checkout closed. No plan was activated.'); error.cancelled = true; reject(error) } } },
    })
    checkout.open()
  })
  if (!payment.razorpay_payment_id || !payment.razorpay_signature || payment.razorpay_order_id !== order.id) {
    throw new Error('Incomplete payment response. Contact support before paying again.')
  }
  sessionStorage.setItem(pendingSubscriptionKey(user), JSON.stringify({
    plan: plan.id, razorpayOrderId: order.id,
    razorpayPaymentId: payment.razorpay_payment_id, razorpaySignature: payment.razorpay_signature,
  }))
  onStage('Verifying payment…')
  return verifyPendingSubscription(user)
}
