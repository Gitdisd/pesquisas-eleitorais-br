import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateHouseEffects } from '../src/stats/house-effects.js'

test('house effects preserve the previous peer/shrinkage formula', () => {
  const day = 86_400_000
  const points = [
    { t: 0, y: 10, n: 2_000, institute: 'A' },
    { t: 0, y: 20, n: 2_000, institute: 'B' },
    { t: day, y: 12, n: 2_000, institute: 'A' },
    { t: day, y: 18, n: 2_000, institute: 'B' },
    { t: 20 * day, y: 50, n: 2_000, institute: 'C' },
  ]

  const house = estimateHouseEffects(points)
  assert.ok(Math.abs(house.A - (-8 / 3)) < 1e-12)
  assert.ok(Math.abs(house.B - (8 / 3)) < 1e-12)
  assert.equal(house.C, undefined)
})

test('house effects use the canonical sample-size cap and floor', () => {
  const day = 86_400_000
  const points = [
    { t: 0, y: 10, n: 50, institute: 'A' },
    { t: 0, y: 30, n: 8_000, institute: 'B' },
    { t: 20 * day, y: 50, n: 2_000, institute: 'C' },
  ]

  const house = estimateHouseEffects(points)
  assert.ok(Number.isFinite(house.A))
  assert.ok(Number.isFinite(house.B))
  assert.equal(house.C, undefined)
})
