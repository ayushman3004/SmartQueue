export function safeReturnTo(value, fallback = '/customers') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) return fallback
  const path = value.split(/[?#]/)[0].replace(/\/+$/, '')
  if (['/login', '/auth/callback', '/401', '/403', '/unauthorized'].includes(path)) return fallback
  return value
}
