import test from 'node:test'
import assert from 'node:assert/strict'
import { readRazorpayCredentials, classifyRazorpayOrderError } from '../src/modules/payment/razorpay.config.js'
import { getRazorpayClient } from '../src/modules/payment/razorpay.service.js'

test('normalizes deployment whitespace and quotes, rejects placeholders', () => {
  const config = readRazorpayCredentials({ RAZORPAY_KEY_ID: ' "rzp_test_abcdef" ', RAZORPAY_KEY_SECRET: " 'secret-value' " })
  assert.equal(config.configured, true)
  assert.equal(config.keyId, 'rzp_test_abcdef')
  assert.equal(config.secret, 'secret-value')
  assert.equal(readRazorpayCredentials({ RAZORPAY_KEY_ID: 'rzp_test_your_key_id_here', RAZORPAY_KEY_SECRET: 'your_secret' }).configured, false)
})

test('rebuilds cached SDK when only the secret changes', (t) => {
  const oldId = process.env.RAZORPAY_KEY_ID
  const oldSecret = process.env.RAZORPAY_KEY_SECRET
  t.after(() => {
    for (const [key, value] of [['RAZORPAY_KEY_ID', oldId], ['RAZORPAY_KEY_SECRET', oldSecret]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value
    }
  })
  process.env.RAZORPAY_KEY_ID = 'rzp_test_cachecheck'
  process.env.RAZORPAY_KEY_SECRET = 'first-secret'
  const first = getRazorpayClient()
  assert.ok(first)
  assert.equal(first, getRazorpayClient())
  process.env.RAZORPAY_KEY_SECRET = 'second-secret'
  assert.notEqual(getRazorpayClient(), first)
})

test('classifies provider failures without exposing raw errors or credentials', () => {
  const error = { statusCode: 401, error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed: secret=do-not-leak', reason: 'authentication_failed' }, config: { auth: { password: 'do-not-leak' } } }
  const result = classifyRazorpayOrderError(error)
  assert.equal(result.kind, 'GATEWAY_AUTHENTICATION_FAILED')
  assert.ok(!JSON.stringify(result).includes('do-not-leak'))
  assert.equal(classifyRazorpayOrderError({ statusCode: 400 }).kind, 'ORDER_REJECTED')
  assert.equal(classifyRazorpayOrderError({ statusCode: 403 }).kind, 'GATEWAY_ACCESS_DENIED')
  assert.equal(classifyRazorpayOrderError({ statusCode: 429 }).kind, 'GATEWAY_RATE_LIMITED')
  assert.equal(classifyRazorpayOrderError(new Error('offline')).kind, 'PROVIDER_UNAVAILABLE')
})
