import assert from 'node:assert/strict'
import { weightedEstimate } from '../src/stats/estimator.js'
import { weightedTrendV1, trendAt } from '../src/aggregate.ts'

const DAY = 86_400_000
const points = [
  { t: 0, y: 38.0, n: 1200, institute: 'A' },
  { t: DAY, y: 39.0, n: 2200, institute: 'B' },
  { t: 2 * DAY, y: 41.0, n: 4050, institute: 'C' },
  { t: 4 * DAY, y: 40.0, n: 800, institute: 'D' },
  { t: 6 * DAY, y: 42.0, n: 3000, institute: 'E' },
  { t: 8 * DAY, y: 41.5, n: 150, institute: 'F' },
]

const halfLifeDays = 14
const trend = weightedTrendV1(points, halfLifeDays)

for (const date of [0, DAY, 2 * DAY, 4 * DAY, 6 * DAY, 8 * DAY]) {
  const canonical = weightedEstimate(points, {
    date,
    candidate: 'fixture',
    halfLifeDays,
  })
  const production = trendAt(trend, date)
  assert.notEqual(production, null)
  const roundedCanonical = Math.round(canonical.estimate * 100) / 100
  assert.equal(
    production,
    roundedCanonical,
    `date ${date}: production=${production} roundedCanonical=${roundedCanonical} canonical=${canonical.estimate}`,
  )
}

console.log('Canonical estimator matches production weightedTrendV1 at fixture dates.')
