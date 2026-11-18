// Keep server credentials authoritative; frontend keys must never select the account.
export function cleanPaymentCredential(value) {
  const text = String(value || '').trim()
  return ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))
    ? text.slice(1, -1).trim() : text
}

export function readRazorpayCredentials(env = process.env) {
  const keyId = cleanPaymentCredential(env.RAZORPAY_KEY_ID)
  const secret = cleanPaymentCredential(env.RAZORPAY_KEY_SECRET)
  const placeholder = /placeholder|your[_-]|xxxxx/i
  return {
    keyId, secret,
    configured: /^rzp_(test|live)_[a-zA-Z0-9]+$/.test(keyId) && Boolean(secret) && !placeholder.test(keyId) && !placeholder.test(secret),
  }
}

export function classifyRazorpayOrderError(error) {
  const status = Number(error?.statusCode || error?.response?.status || 0)
  const provider = error?.error || error?.response?.data?.error || {}
  const description = String(provider.description || error?.message || '')
  let kind = 'PROVIDER_UNAVAILABLE'
  let message = 'Unable to create payment order. The payment provider is unavailable; please try again later.'
  if (status === 401 || /authentication failed|invalid api key|invalid key|unauthori[sz]ed/i.test(description)) {
    kind = 'GATEWAY_AUTHENTICATION_FAILED'
    message = 'Payment gateway authentication failed. The business cannot accept subscription payments until the server’s Razorpay key ID and secret are corrected. Please contact support.'
  } else if (status === 403) {
    kind = 'GATEWAY_ACCESS_DENIED'
    message = 'Razorpay has restricted this payment account. Please contact support so the account configuration can be checked.'
  } else if (status === 400 || status === 422) {
    kind = 'ORDER_REJECTED'
    message = 'Razorpay rejected the payment order. Please contact support so the order and payment-account settings can be checked.'
  } else if (status === 429) {
    kind = 'GATEWAY_RATE_LIMITED'
    message = 'The payment provider is receiving too many requests. Wait a moment, then try again.'
  }
  // Log only allowlisted diagnostic fields; never error.config, headers or raw descriptions.
  const safeField = (value) => typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(value) ? value : undefined
  return { kind, message, providerStatus: status || undefined, providerCode: safeField(provider.code), providerReason: safeField(provider.reason), providerField: safeField(provider.field) }
}
