import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { weightedEstimate } from '../src/stats/estimator.js'
import { weightedTrendV1 } from '../src/aggregate.ts'

const wasm = await import('../public/wasm/polling-core/polling_core.js')
const bytes = await fs.readFile(new URL('../public/wasm/polling-core/polling_core_bg.wasm', import.meta.url))
await wasm.default(bytes)

const points = [
  { t: 0, y: 38.0, n: 1200, institute: 'A' },
  { t: 86_400_000, y: 40.0, n: 2200, institute: 'B' },
  { t: 2 * 86_400_000, y: 41.0, n: 4000, institute: 'C' },
]
const options = { date: 2 * 86_400_000, candidate: 'fixture', halfLifeDays: 14 }
const js = weightedEstimate(points, options)
const rust = wasm.weighted_estimate(points, options.date, options.candidate, options.halfLifeDays)

assert.equal(rust.date, options.date)
assert.equal(rust.candidate, options.candidate)
assert.ok(js.estimate != null)
assert.ok(rust.estimate != null)
assert.ok(Math.abs(rust.estimate - js.estimate) < 1e-12)
assert.ok(Math.abs(rust.effective_sample_size - js.effectiveSampleSize) < 1e-12)

console.log('Generated browser-target WASM matches canonical JS estimator.')

const trendPoints = [
  { t: 0, y: 38.0, n: 1200, institute: 'A' },
  { t: 86_400_000, y: 40.0, n: 2200, institute: 'B' },
  { t: 2 * 86_400_000, y: 41.0, n: 4000, institute: 'C' },
  { t: 3 * 86_400_000, y: 40.0, n: 1800, institute: 'D' },
]
const jsTrend = weightedTrendV1(
  trendPoints,
  14,
)

const rustTrend = wasm.weighted_trend(trendPoints, 14)
assert.deepEqual(rustTrend, jsTrend)
