import assert from 'node:assert/strict'
import test from 'node:test'
import { placeTourGuide } from '../src/utils/tourPlacement.js'

test('spotlight guide sits beside the target on desktop and below it in a narrow viewport', () => {
  const desktop = placeTourGuide({ left: 80, right: 520, top: 120, bottom: 320 },
    { width: 360, height: 260 }, { width: 1200, height: 720 })
  assert.ok(desktop.guide.left > desktop.spotlight.left + desktop.spotlight.width)
  assert.equal(desktop.guide.top, desktop.spotlight.top)

  const mobile = placeTourGuide({ left: 20, right: 355, top: 100, bottom: 275 },
    { width: 350, height: 270 }, { width: 375, height: 667 })
  assert.ok(mobile.guide.top > mobile.spotlight.top + mobile.spotlight.height)
  assert.ok(mobile.guide.left + 350 < 375)
})

test('spotlight falls back to a readable guide if it would otherwise cover the target', () => {
  const { guide, spotlight } = placeTourGuide({ left: 12, right: 290, top: 60, bottom: 300 },
    { width: 296, height: 265 }, { width: 320, height: 400 })
  assert.equal(spotlight, null)
  assert.ok(guide.left >= 0 && guide.top + 265 <= 400)
})
