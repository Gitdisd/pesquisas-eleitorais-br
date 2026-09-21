import test from 'node:test'
import assert from 'node:assert/strict'
import { sampleSize, weightedMean } from '../src/stats/contract.js'

test('canonical sample-size rules', () => {
  assert.equal(sampleSize(9000), 4000)
  assert.equal(sampleSize(50), 100)
  assert.equal(sampleSize(0), 800)
})

test('canonical weighted-mean golden fixture', () => {
  const rows = [
    { t: 0, y: 40, n: 2000 },
    { t: 86400000 * 7, y: 50, n: 4000 },
    { t: 86400000 * 14, y: 45, n: 1000 },
  ]
  const value = weightedMean(rows, 86400000 * 7, 14)
  assert.ok(value != null)
  assert.equal(Number(value.toFixed(6)), 46.348761)
})
