import fs from 'node:fs'

import { averageTrend } from '../src/aggregate.ts'

const DAY_MS = 86_400_000
const MODELS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const MODEL_NAMES = Object.freeze({
  3: 'model-3-random-effects',
  4: 'model-4-kalman',
  5: 'model-5-punch',
  6: 'model-6-institute-dedupe',
  7: 'model-7-local-linear',
  8: 'model-8-school-mean',
  9: 'model-9-school-weight',
  10: 'model-10-school-median',
  11: 'model-11-school-mode',
  12: 'model-12-school-trim',
})

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

function parseDateMs(value) {
  const day = String(value ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const ms = Date.parse(day + 'T12:00:00Z')
  return Number.isFinite(ms) ? ms : null
}

function candidateSeries(rows) {
  const groups = new Map()
  for (const row of rows) {
    const t = parseDateMs(row.fieldwork_end || row.published_date)
    if (t == null || !row.scenario) continue
    for (const candidate of row.candidates || []) {
      const y = Number(candidate.pct)
      if (!Number.isFinite(y)) continue
      const canonical = normalizeName(candidate.name)
      if (!canonical) continue
      const key = JSON.stringify([row.scenario, canonical])
      const series = groups.get(key) || {
        scenario: row.scenario,
        candidate: candidate.name,
        rows: [],
      }
      series.rows.push({
        t,
        y,
        n: Number(row.n) || 800,
        institute: row.institute || null,
        moe: Number.isFinite(Number(row.moe)) ? Number(row.moe) : null,
      })
      groups.set(key, series)
    }
  }
  for (const series of groups.values()) {
    series.rows.sort((a, b) => a.t - b.t)
  }
  return [...groups.values()]
}

function dateMean(rows, date) {
  const values = rows.filter((row) => row.t === date).map((row) => row.y)
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

function lastAtOrBefore(line, origin) {
  let best = null
  for (const point of line) {
    if (point.x > origin) continue
    if (!best || point.x > best.x) best = point
  }
  return best
}

function scoreGroup(series) {
  const rows = series.rows
  const dates = [...new Set(rows.map((row) => row.t))].sort((a, b) => a - b)
  if (dates.length < 6) return []

  const scored = []
  for (const origin of dates.slice(5)) {
    const history = rows.filter((row) => row.t <= origin)
    const persistence = dateMean(rows, origin)
    if (persistence == null) continue

    for (const model of MODELS) {
      const trend = averageTrend(history, 14, model)
      const last = lastAtOrBefore(trend, origin)
      if (!last || !Number.isFinite(last.y)) continue

      for (const horizonDays of [1, 3, 7, 14]) {
        const nominalTarget = origin + horizonDays * DAY_MS
        const target = dates.find((date) => date >= nominalTarget)
        if (target == null || target > origin + 14 * DAY_MS) continue

        const actual = dateMean(rows, target)
        if (actual == null) continue

        scored.push({
          model,
          modelName: MODEL_NAMES[model] || `model-${model}`,
          horizonDays,
          scenario: series.scenario,
          candidate: series.candidate,
          origin,
          targetDate: target,
          targetLagDays: (target - nominalTarget) / DAY_MS,
          actual,
          predicted: last.y,
          persistence,
        })
      }
    }
  }
  return scored
}

function summarize(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = `${row.model}:s${row.horizonDays}`
    const group = groups.get(key) || []
    group.push(row)
    groups.set(key, group)
  }

  const summaries = []
  for (const group of groups.values()) {
    const first = group[0]
    const errors = group.map((row) => row.predicted - row.actual)
    const absErrors = errors.map((error) => Math.abs(error))
    const persistenceErrors = group.map((row) => row.persistence - row.actual)
    summaries.push({
      model: first.model,
      modelName: first.modelName,
      horizonDays: first.horizonDays,
      n: group.length,
      mae: absErrors.reduce((a, b) => a + b, 0) / group.length,
      rmse: Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / group.length),
      bias: errors.reduce((a, b) => a + b, 0) / group.length,
      persistenceMae:
        persistenceErrors.reduce((sum, error) => sum + Math.abs(error), 0) / group.length,
      persistenceRmse: Math.sqrt(
        persistenceErrors.reduce((sum, error) => sum + error * error, 0) / group.length,
      ),
      medianTargetLagDays: median(group.map((row) => row.targetLagDays)),
    })
  }

  return summaries.sort(
    (a, b) => a.model - b.model || a.horizonDays - b.horizonDays,
  )
}

function median(values) {
  if (!values.length) return null
  const ordered = [...values].sort((a, b) => a - b)
  const mid = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2
}

function summarizeByGroup(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = JSON.stringify([row.model, row.horizonDays, row.scenario, row.candidate])
    const group = groups.get(key) || []
    group.push(row)
    groups.set(key, group)
  }
  const out = []
  for (const group of groups.values()) {
    const first = group[0]
    const errors = group.map((row) => row.predicted - row.actual)
    out.push({
      model: first.model,
      modelName: first.modelName,
      horizonDays: first.horizonDays,
      scenario: first.scenario,
      candidate: first.candidate,
      n: group.length,
      mae: mean(errors.map(Math.abs)),
      rmse: Math.sqrt(mean(errors.map((error) => error * error))),
      persistenceMae: mean(group.map((row) => Math.abs(row.persistence - row.actual))),
    })
  }
  return out.sort(
    (a, b) =>
      a.model - b.model ||
      a.horizonDays - b.horizonDays ||
      a.scenario.localeCompare(b.scenario) ||
      a.candidate.localeCompare(b.candidate),
  )
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

const input = process.argv[2] || 'data/polls.json'
const outputIndex = process.argv.indexOf('--output')
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : 'advanced-backtest-report.json'

const raw = JSON.parse(fs.readFileSync(input, 'utf8'))
const series = candidateSeries(raw)
const rows = series.flatMap(scoreGroup)
const report = {
  records: raw.length,
  groups: series.length,
  models: MODELS.map((model) => ({ model, modelName: MODEL_NAMES[model] })),
  backtestPoints: rows.length,
  methodology: {
    originRule: 'history is restricted to observations on or before each origin date',
    targetRule: 'first available future observation date at or after the nominal horizon, provided it is within the 14-day evaluation cap',
    predictionRule: 'latest production model estimate at or before the origin is held against the future target',
    persistenceRule: 'date-level mean of raw observations on the origin date',
    horizons: [1, 3, 7, 14],
  },
  metrics: summarize(rows),
  byGroup: summarizeByGroup(rows),
}

fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ output, records: raw.length, groups: series.length, backtestPoints: rows.length }, null, 2))
