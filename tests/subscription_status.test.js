import test from 'node:test'
import assert from 'node:assert/strict'
import { hasActiveSubscription } from '../src/utils/subscription.js'

test('business gates reject expired subscriptions even if persisted status is ACTIVE', () => {
  const now = Date.now()
  assert.equal(hasActiveSubscription({ plan: 'BASIC', status: 'ACTIVE', expiresAt: new Date(now - 1) }, now), false)
  assert.equal(hasActiveSubscription({ plan: 'PRO', status: 'ACTIVE', expiresAt: new Date(now + 1000) }, now), true)
  assert.equal(hasActiveSubscription({ plan: 'NONE', status: 'ACTIVE' }), false)
  assert.equal(hasActiveSubscription(null), false)
  assert.equal(hasActiveSubscription({ plan: 'PRO', status: 'INACTIVE' }), false)
})
