let scriptPromise

export function loadRazorpayCheckout() {
  if (typeof window.Razorpay === 'function') return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    document.getElementById('razorpay-checkout-js')?.remove()
    const script = document.createElement('script')
    script.id = 'razorpay-checkout-js'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    const fail = (message) => { clearTimeout(timer); script.remove(); reject(new Error(message)) }
    const timer = setTimeout(() => fail('Razorpay did not load. Check your connection or content blocker, then try again.'), 15000)
    script.onload = () => {
      clearTimeout(timer)
      if (typeof window.Razorpay === 'function') resolve()
      else fail('Razorpay checkout could not initialize. Please retry.')
    }
    script.onerror = () => fail('Your browser could not load Razorpay. Check your connection or content blocker, then retry.')
    document.body.appendChild(script)
  }).catch((error) => { scriptPromise = null; throw error })
  return scriptPromise
}

export function openRazorpayCheckout({ order, keyId, plan, user }) {
  const amount = Number(order?.amount)
  if (!order?.id || order.isMock || order.id.startsWith('order_mock_') || !keyId || !Number.isSafeInteger(amount) || amount <= 0 || order.currency !== 'INR') {
    return Promise.reject(new Error('The server did not return a valid Razorpay order. Please contact support.'))
  }
  return new Promise((resolve, reject) => {
    let completed = false
    const fail = (error) => { if (!completed) { completed = true; reject(error) } }
    const checkout = new window.Razorpay({
      key: keyId, order_id: order.id, amount, currency: order.currency,
      name: 'serveQ', description: `${plan.name} · 30 days`, image: '/serveq-logo.png',
      prefill: { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
      theme: { color: '#315b45' },
      handler: (result) => { if (!completed) { completed = true; resolve(result) } },
      modal: { ondismiss: () => { const error = new Error('Checkout closed. You can choose a plan to try again.'); error.cancelled = true; fail(error) } },
    })
    checkout.on('payment.failed', (result) => {
      fail(new Error(result.error?.description || 'Razorpay could not complete the payment. Please try again.'))
      checkout.close()
    })
    try { checkout.open() } catch (error) { fail(error) }
  })
}
