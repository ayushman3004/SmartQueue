export function hasActiveSubscription(subscription, now = Date.now()) {
  return Boolean(subscription?.status === 'ACTIVE' && ['BASIC', 'PRO'].includes(subscription.plan) &&
    (!subscription.expiresAt || new Date(subscription.expiresAt).getTime() > now))
}

// Derive the entitlement from the authenticated database role, never a request flag.
export function effectiveSubscription(user) {
  return user?.role === 'admin'
    ? { plan: 'PRO', status: 'ACTIVE', amount: 0, expiresAt: null, source: 'ADMIN' }
    : user?.subscription || { plan: 'NONE', status: 'INACTIVE', amount: 0 };
}
