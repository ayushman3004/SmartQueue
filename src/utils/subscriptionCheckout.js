import { createSubscriptionOrder, verifySubscriptionPayment } from '../api/subscription.api'
import { loadRazorpayCheckout, openRazorpayCheckout } from './razorpayCheckout'
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
  onStage('Loading Razorpay…')
  await loadRazorpayCheckout()
  onStage('Creating your payment order…')
  const { data: response } = await createSubscriptionOrder(plan.id)
  const data = response?.data
  if (!data?.order) throw new Error('The payment server returned an incomplete response. Please retry.')
  const { order, keyId } = data
  onStage('Complete payment in Razorpay…')
  const payment = await openRazorpayCheckout({ order, keyId, plan, user })
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
