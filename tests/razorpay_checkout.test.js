import test from 'node:test'
import assert from 'node:assert/strict'
import { loadRazorpayCheckout, openRazorpayCheckout } from '../src/utils/razorpayCheckout.js'

const options = {
  order: { id: 'order_subscription_test', amount: 79900, currency: 'INR' },
  keyId: 'rzp_test_unit', plan: { name: 'Basic Plan' }, user: { name: 'Test Owner' },
}

test('checkout loads the SDK, retries script failures, and launches the server order', async (t) => {
  const oldWindow = globalThis.window
  const oldDocument = globalThis.document
  t.after(() => { globalThis.window = oldWindow; globalThis.document = oldDocument })
  let shouldFail = true
  let scripts = 0
  let captured
  let instance
  globalThis.window = {}
  class Checkout {
    constructor(value) { captured = value; instance = this; this.events = {} }
    on(name, handler) { this.events[name] = handler }
    open() { this.opened = true }
    close() { this.closed = true; captured.modal.ondismiss() }
  }
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ remove() {} }),
    body: { appendChild(script) {
      scripts++
      queueMicrotask(() => {
        if (shouldFail) script.onerror()
        else { window.Razorpay = Checkout; script.onload() }
      })
    } },
  }
  await assert.rejects(loadRazorpayCheckout(), /could not load Razorpay/)
  shouldFail = false
  await loadRazorpayCheckout()
  assert.equal(scripts, 2)
  const result = openRazorpayCheckout(options)
  assert.equal(instance.opened, true)
  assert.equal(captured.order_id, options.order.id)
  assert.equal(captured.amount, 79900)
  const payment = { razorpay_order_id: options.order.id, razorpay_payment_id: 'pay_unit', razorpay_signature: 'signed' }
  captured.handler(payment)
  assert.deepEqual(await result, payment)
  captured.modal.ondismiss()

  const cancelled = openRazorpayCheckout(options)
  captured.modal.ondismiss()
  await assert.rejects(cancelled, (error) => error.cancelled === true)

  const failed = openRazorpayCheckout(options)
  instance.events['payment.failed']({ error: { description: 'Test payment declined' } })
  await assert.rejects(failed, /declined/)
  assert.equal(instance.closed, true)

  await assert.rejects(openRazorpayCheckout({ ...options, order: { ...options.order, isMock: true } }), /valid Razorpay order/)
  await assert.rejects(openRazorpayCheckout({ ...options, order: { ...options.order, amount: 0 } }), /valid Razorpay order/)
})
