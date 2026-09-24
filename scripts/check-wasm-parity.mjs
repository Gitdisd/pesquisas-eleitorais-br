import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { weightedEstimate } from '../src/stats/estimator.js'
import { averageTrendAdvanced } from '../src/models/advanced.ts'
import { projectTrendV2 } from '../src/projection-v2.js'

const wasm = await import('../public/wasm/polling-core/polling_core.js')
const bytes = await fs.readFile(new URL('../public/wasm/polling-core/polling_core_bg.wasm', import.meta.url))
await wasm.default(bytes)

const DAY_MS = 86_400_000
const points = [
  { t: 0, y: 40.0, n: 1800, institute: 'A', moe: 2.1 },
  { t: DAY_MS, y: 42.5, n: 2400, institute: 'A', moe: 1.8 },
  { t: 2 * DAY_MS, y: 39.0, n: 1200, institute: 'B', moe: null },
  { t: 3 * DAY_MS, y: 44.0, n: 3200, institute: 'C', moe: 2.3 },
  { t: 4 * DAY_MS, y: 41.5, n: 2000, institute: 'A', moe: null },
  { t: 6 * DAY_MS, y: 46.0, n: 900, institute: 'B', moe: 3.1 },
  { t: 7 * DAY_MS, y: 43.5, n: 4000, institute: 'C', moe: null },
  { t: 9 * DAY_MS, y: 45.0, n: 1500, institute: 'A', moe: 2.0 },
  { t: 10 * DAY_MS, y: 47.5, n: 2500, institute: 'B', moe: 1.9 },
]

const options = { date: 2 * DAY_MS, candidate: 'fixture', halfLifeDays: 14 }
const js = weightedEstimate(points, options)
const rust = wasm.weighted_estimate(points, options.date, options.candidate, options.halfLifeDays)

assert.equal(rust.date, options.date)
assert.equal(rust.candidate, options.candidate)
assert.ok(js.estimate != null)
assert.ok(rust.estimate != null)
assert.ok(Math.abs(rust.estimate - js.estimate) < 1e-12)
assert.ok(Math.abs(rust.effective_sample_size - js.effectiveSampleSize) < 1e-12)

const advancedResults = []
for (const model of Array.from({ length: 10 }, (_, index) => index + 3)) {
  const jsTrend = averageTrendAdvanced(points, 14, model)
  const rustTrend = wasm.advanced_trend(points, 14, model)

  assert.equal(rustTrend.length, jsTrend.length, `model ${model}: point count differs`)
  for (let i = 0; i < jsTrend.length; i += 1) {
    assert.equal(rustTrend[i].x, jsTrend[i].x, `model ${model}: x differs at index ${i}`)
    assert.ok(
      Math.abs(rustTrend[i].y - jsTrend[i].y) < 1e-9,
      `model ${model}: y differs at index ${i}: rust=${rustTrend[i].y}, js=${jsTrend[i].y}`,
    )
  }

  advancedResults.push({ model, points: jsTrend.length })
}

const projectionBase = Date.parse('2026-09-01T00:00:00Z')
const projectionPoints = Array.from({ length: 12 }, (_, day) => ({
  t: projectionBase + day * DAY_MS,
  y: 40 + 0.8 * day,
  n: 2000,
  institute: 'ParityLab',
  moe: null,
}))
const projectionOptions = {
  fitDays: 14,
  horizonDays: 14,
  electionDayMs: Date.parse('2026-10-04T12:00:00Z'),
}
const jsProjection = projectTrendV2(projectionPoints, projectionOptions)
const rustProjection = wasm.project_trend_v2_wasm({
  observations: projectionPoints,
  fit_days: projectionOptions.fitDays,
  horizon_days: projectionOptions.horizonDays,
  election_day_ms: projectionOptions.electionDayMs,
})

function compareProjectionPoints(label, rustPoints, jsPoints) {
  assert.equal(rustPoints.length, jsPoints.length, `${label}: point count differs`)
  for (let i = 0; i < jsPoints.length; i += 1) {
    assert.equal(rustPoints[i].x, jsPoints[i].x, `${label}: x differs at index ${i}`)
    assert.ok(Math.abs(rustPoints[i].y - jsPoints[i].y) < 1e-12, `${label}: y differs at index ${i}`)
  }
}

assert.equal(rustProjection.ok, jsProjection.ok)
assert.equal(rustProjection.reason ?? null, jsProjection.reason ?? null)
assert.equal(rustProjection.lastObserved ?? null, jsProjection.lastObserved ?? null)
assert.equal(rustProjection.horizonUsed, jsProjection.horizonUsed)
assert.equal(rustProjection.model, jsProjection.model)
assert.ok(Math.abs(rustProjection.slope - jsProjection.slope) < 1e-12)
assert.ok(Math.abs(rustProjection.rmse - jsProjection.rmse) < 1e-12)
assert.equal(rustProjection.holdout.pass, jsProjection.holdout.pass)
assert.equal(rustProjection.holdout.reason ?? null, jsProjection.holdout.reason ?? null)
assert.ok(Math.abs(rustProjection.holdout.rmseModel - jsProjection.holdout.rmseModel) < 1e-12)
assert.ok(Math.abs(rustProjection.holdout.rmsePersist - jsProjection.holdout.rmsePersist) < 1e-12)
compareProjectionPoints('projection line', rustProjection.line, jsProjection.line)
compareProjectionPoints('projection lower band', rustProjection.bandLow, jsProjection.bandLow)
compareProjectionPoints('projection upper band', rustProjection.bandHigh, jsProjection.bandHigh)
console.log(JSON.stringify({
  canonicalEstimator: 'pass',
  advancedModels: advancedResults,
  projectionV2: 'pass',
}))
