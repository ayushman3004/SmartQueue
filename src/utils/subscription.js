export function hasActiveSubscription(subscription, now = Date.now()) {
  return Boolean(subscription?.status === 'ACTIVE' && ['BASIC', 'PRO'].includes(subscription.plan) &&
    (!subscription.expiresAt || new Date(subscription.expiresAt).getTime() > now))
}
