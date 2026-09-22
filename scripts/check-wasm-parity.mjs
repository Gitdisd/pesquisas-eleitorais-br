import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { weightedEstimate } from '../src/stats/estimator.js'

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
const jsTrend = []
for (let t = trendPoints[0].t; t <= trendPoints.at(-1).t; t += 86_400_000) {
  let num = 0
  let den = 0
  let nearest = Infinity
  for (const row of trendPoints) {
    const days = Math.abs(t - row.t) / 86_400_000
    nearest = Math.min(nearest, days)
    if (days > 35) continue
    const w = Math.sqrt(Math.min(4000, Math.max(100, row.n)) / 2000) * 2 ** (-days / 14)
    num += w * row.y
    den += w
  }
  if (den > 0 && nearest <= 14) jsTrend.push({ x: t, y: Math.round((num / den) * 100) / 100 })
}
const rustTrend = wasm.weighted_trend(trendPoints, 14)
assert.deepEqual(rustTrend, jsTrend)
