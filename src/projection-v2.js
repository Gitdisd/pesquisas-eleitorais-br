import { weightedTrendV2 } from './aggregate.js'
import { projectTrend } from './projection.js'

const DAY = 86400000
const CAMPAIGN_MS = Date.parse('2026-08-16T12:00:00Z')

function nearest(line, x) {
  if (!line?.length) return null
  let best = line[0]
  let bestD = Math.abs(line[0].x - x)
  for (const p of line) {
    const d = Math.abs(p.x - x)
    if (d < bestD) {
      best = p
      bestD = d
    }
  }
  return best
}

export function processSdFor(tLast, electionDayMs) {
  let sd = 0.12
  if (tLast >= CAMPAIGN_MS) sd = 0.18
  if (electionDayMs && (electionDayMs - tLast) / DAY <= 14) sd = 0.26
  return sd
}

export function estimateHouseEffects(points, peerDays = 14) {
  const acc = new Map()
  for (const p of points) {
    if (p.y == null || !p.institute) continue
    let num = 0
    let den = 0
    for (const q of points) {
      if (q.y == null || !q.institute || q.institute === p.institute) continue
      const days = Math.abs(q.t - p.t) / DAY
      if (days > peerDays) continue
      const w = Math.sqrt((Number(q.n) > 0 ? q.n : 800) / 2000)
      num += w * q.y
      den += w
    }
    if (den <= 0) continue
    const peer = num / den
    if (!acc.has(p.institute)) acc.set(p.institute, { s: 0, n: 0 })
    const a = acc.get(p.institute)
    a.s += p.y - peer
    a.n += 1
  }
  const out = {}
  for (const [k, v] of acc) {
    const raw = v.s / v.n
    const shrink = v.n / (v.n + 4)
    out[k] = Math.abs(raw) < 0.05 ? 0 : raw * shrink
  }
  return out
}

export function holdoutGate(series, opts = {}) {
  const fail = (reason) => ({
    pass: false,
    reason,
    rmseModel: null,
    rmsePersist: null,
  })
  if (!series || series.length < 8) return fail('short_series')
  const tLast = series[series.length - 1].x
  const cut = tLast - 7 * DAY
  const train = series.filter((p) => p.x <= cut)
  const test = series.filter((p) => p.x > cut)
  if (train.length < 4 || test.length < 2) return fail('thin_holdout')
  const persist = train[train.length - 1].y
  const proj = projectTrend(train, {
    fitDays: opts.fitDays ?? 14,
    horizonDays: 8,
    electionDayMs: null,
    processSd: opts.processSd,
    bandFloor: opts.bandFloor,
  })
  if (!proj.ok || !proj.line.length) return fail('proj_failed')
  let seM = 0
  let seP = 0
  for (const t of test) {
    const pred = nearest(proj.line, t.x)?.y ?? persist
    seM += (pred - t.y) ** 2
    seP += (persist - t.y) ** 2
  }
  const rmseModel = Math.sqrt(seM / test.length)
  const rmsePersist = Math.sqrt(seP / test.length)
  return {
    pass: rmseModel + 1e-6 < rmsePersist,
    reason: rmseModel < rmsePersist ? null : 'holdout_fail',
    rmseModel,
    rmsePersist,
  }
}

export function projectTrendV2(rawPoints, opts = {}) {
  const empty = (reason) => ({
    ok: false,
    reason,
    line: [],
    bandLow: [],
    bandHigh: [],
    lastObserved: null,
    slope: null,
    rmse: null,
    horizonUsed: 0,
    holdout: null,
    house: {},
    model: 2,
  })
  if (!rawPoints?.length) return empty('empty_series')

  const house = estimateHouseEffects(rawPoints)
  const debiased = rawPoints.map((p) => ({
    t: p.t,
    y: p.y - (house[p.institute] || 0),
    n: p.n,
  }))
  const fitDays = opts.fitDays ?? 14
  const trend = weightedTrendV2(debiased, fitDays)
  if (trend.length < 4) return empty('insufficient_points')

  const tLast = trend[trend.length - 1].x
  const sd = processSdFor(tLast, opts.electionDayMs ?? null)
  const gate = holdoutGate(trend, { fitDays, processSd: sd, bandFloor: 2.4 })
  if (!gate.pass) {
    return { ...empty(gate.reason), lastObserved: tLast, holdout: gate, house }
  }

  const proj = projectTrend(trend, {
    fitDays,
    horizonDays: opts.horizonDays ?? 14,
    electionDayMs: opts.electionDayMs ?? null,
    processSd: sd,
    bandFloor: 2.4,
    maxAbsSlope: 0.2,
  })
  return { ...proj, holdout: gate, house, model: 2 }
}

export function rescaleComposition(projByKey, leadKeys) {
  const keys = leadKeys.filter((k) => projByKey[k]?.ok && projByKey[k].line?.length)
  if (keys.length < 2) return
  const n = Math.min(...keys.map((k) => projByKey[k].line.length))
  const target = keys.reduce((s, k) => s + projByKey[k].line[0].y, 0)
  if (target <= 1) return
  for (let i = 1; i < n; i++) {
    const sum = keys.reduce((s, k) => s + projByKey[k].line[i].y, 0)
    if (sum <= 0) continue
    const sc = target / sum
    for (const k of keys) {
      const p = projByKey[k]
      p.line[i].y = Math.round(p.line[i].y * sc * 10) / 10
      const mid = p.line[i].y
      const half = Math.max(0, (p.bandHigh[i].y - p.bandLow[i].y) / 2)
      p.bandLow[i].y = Math.max(0, Math.round((mid - half) * 10) / 10)
      p.bandHigh[i].y = Math.min(100, Math.round((mid + half) * 10) / 10)
    }
  }
}

export function formatProjSummary(projByKey, labels) {
  const bits = []
  for (const [key, proj] of Object.entries(projByKey)) {
    if (!proj?.ok || proj.slope == null) continue
    const lab = labels[key] || key
    const s = proj.slope * 10
    const sign = s >= 0 ? '+' : ''
    const last = proj.line[proj.line.length - 1]
    const lo = proj.bandLow[proj.bandLow.length - 1]?.y
    const hi = proj.bandHigh[proj.bandHigh.length - 1]?.y
    bits.push(`${lab} ${sign}${s.toFixed(1).replace('.', ',')} pp/10d → ${last.y.toLocaleString('pt-BR')}% [${lo}–${hi}]`)
  }
  return bits.join(' · ')
}
