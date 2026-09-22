import type { SeriesPoint, TrendPoint } from '../data/types'
import { schoolCenterTrend } from './school'
import { sampleSize, N_REF, DAY_MS } from '../stats/contract'
import { estimateHouseEffects } from '../stats/house-effects'

const DAY = DAY_MS
const DEFF = 1.3
const sampleN = sampleSize

export function pollSE(p: TrendPoint): number {
  const moe = Number(p.moe)
  if (Number.isFinite(moe) && moe > 0) return Math.max(0.4, moe / 1.96)
  const n = sampleN(p.n)
  const y = Math.min(95, Math.max(5, Number(p.y) || 30))
  return Math.max(0.5, DEFF * Math.sqrt((y * (100 - y)) / n))
}

function recencyW(days: number, half: number): number {
  return Math.pow(2, -Math.max(0, days) / Math.max(1, half))
}

function buildFloodIndex(points: TrendPoint[], half: number): Map<string, number> {
  const span = Math.ceil(Math.max(14, half))
  const index = new Map<string, number>()
  for (const p of points) {
    if (!p.institute) continue
    const day = Math.round(p.t / DAY)
    for (let offset = -span; offset <= span; offset += 1) {
      const key = `${p.institute}\u0000${day + offset}`
      index.set(key, (index.get(key) || 0) + 1)
    }
  }
  return index
}

function floodK(index: Map<string, number>, inst: string | undefined, t: number): number {
  if (!inst) return 1
  return Math.max(1, index.get(`${inst}\u0000${Math.round(t / DAY)}`) || 0)
}

export function dlTau2(items: Array<{ y: number; se: number }>): number {
  if (!items.length) return 0
  let sw = 0
  let swy = 0
  for (const it of items) {
    const w = 1 / Math.max(1e-6, it.se * it.se)
    sw += w
    swy += w * it.y
  }
  if (sw <= 0) return 0
  const mu = swy / sw
  let q = 0
  let sw2 = 0
  for (const it of items) {
    const w = 1 / Math.max(1e-6, it.se * it.se)
    const d = it.y - mu
    q += w * d * d
    sw2 += w * w
  }
  const df = Math.max(1, items.length - 1)
  const c = sw - sw2 / sw
  const tau = c > 0 ? Math.max(0, (q - df) / c) : 0
  return Math.min(25, tau)
}

export function weightedTrendV3(points: TrendPoint[], windowDays = 14): SeriesPoint[] {
  if (!points.length) return []
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const half = Math.max(1, Number(windowDays) || 14)
  const reach = half * 2.5
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const floodIndex = buildFloodIndex(sorted, half)
  const out: SeriesPoint[] = []
  for (let t = tMin; t <= tMax; t += DAY) {
    const bag: Array<{ y: number; se: number; rw: number }> = []
    let nearest = Infinity
    for (const p of sorted) {
      const days = Math.abs(t - p.t) / DAY
      if (days < nearest) nearest = days
      if (days > reach) continue
      bag.push({
        y: p.y,
        se: pollSE(p),
        rw: recencyW(days, half) / floodK(floodIndex, p.institute, t),
      })
    }
    if (!bag.length || nearest > half) continue
    const tau2 = dlTau2(bag)
    let num = 0
    let den = 0
    for (const b of bag) {
      const w = b.rw / (b.se * b.se + tau2)
      num += w * b.y
      den += w
    }
    if (den > 0) out.push({ x: t, y: Math.round((num / den) * 100) / 100 })
  }
  return out
}

export function weightedTrendV4(points: TrendPoint[], _windowDays = 14): SeriesPoint[] {
  if (!points.length) return []
  const house = estimateHouseEffects(points)
  const sorted = [...points]
    .map((p) => ({ ...p, y: p.y - (house[p.institute || ''] || 0) }))
    .sort((a, b) => a.t - b.t)
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const q = 0.16 * 0.16
  const byDay = new Map<number, TrendPoint[]>()
  for (const p of sorted) {
    const d = Math.round(p.t / DAY)
    const bucket = byDay.get(d) || []
    bucket.push(p)
    byDay.set(d, bucket)
  }
  let theta = sorted[0].y
  let P = 9
  const fwd: Array<{ x: number; m: number; P: number }> = []
  for (let t = tMin; t <= tMax; t += DAY) {
    P += q
    const bucket = byDay.get(Math.round(t / DAY)) || []
    for (const p of bucket) {
      const R = pollSE(p) ** 2
      const K = P / (P + R)
      theta += K * (p.y - theta)
      P = (1 - K) * P
    }
    fwd.push({ x: t, m: theta, P })
  }
  const sm = new Array<{ m: number; P: number }>(fwd.length)
  sm[sm.length - 1] = { m: fwd[fwd.length - 1].m, P: fwd[fwd.length - 1].P }
  for (let i = fwd.length - 2; i >= 0; i -= 1) {
    const pPred = fwd[i].P + q
    const C = fwd[i].P / Math.max(1e-9, pPred)
    const m = fwd[i].m + C * (sm[i + 1].m - fwd[i].m)
    sm[i] = { m, P: fwd[i].P + C * C * (sm[i + 1].P - pPred) }
  }
  return sm.map((s, i) => ({ x: fwd[i].x, y: Math.round(Math.min(100, Math.max(0, s.m)) * 100) / 100 }))
}

export function weightedTrendV5(points: TrendPoint[], windowDays = 14): SeriesPoint[] {
  if (!points.length) return []
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const half = Math.max(2, (Number(windowDays) || 14) / 5)
  const reach = Math.max(8, half * 4)
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const out: SeriesPoint[] = []
  for (let t = tMin; t <= tMax; t += DAY) {
    let num = 0
    let den = 0
    let nearest = Infinity
    for (const p of sorted) {
      const days = Math.abs(t - p.t) / DAY
      if (days < nearest) nearest = days
      if (days > reach) continue
      const sizeW = Math.sqrt(sampleN(p.n) / N_REF)
      const rec = Math.pow(2, -days / half)
      const punch = 1 + 2 * Math.exp(-days / 1.8)
      const w = sizeW * rec * punch
      num += w * p.y
      den += w
    }
    if (den > 0 && nearest <= Math.max(3, half * 1.5)) {
      out.push({ x: t, y: Math.round((num / den) * 100) / 100 })
    }
  }
  return out
}

export function weightedTrendV6(points: TrendPoint[]): SeriesPoint[] {
  if (!points.length) return []
  const byDay = new Map<number, Map<string, { y: number; w: number }>>()
  for (const p of points) {
    if (p.y == null || !Number.isFinite(p.y)) continue
    const day = Math.round(p.t / DAY) * DAY
    const inst = p.institute || '_'
    const w = Math.sqrt(sampleN(p.n) / N_REF)
    if (!byDay.has(day)) byDay.set(day, new Map())
    const bag = byDay.get(day)
    if (!bag) continue
    const cur = bag.get(inst)
    if (!cur) bag.set(inst, { y: p.y, w })
    else {
      const nw = cur.w + w
      bag.set(inst, { y: (cur.y * cur.w + p.y * w) / nw, w: nw })
    }
  }
  const out: SeriesPoint[] = []
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    let num = 0
    let den = 0
    const bag = byDay.get(day)
    if (!bag) continue
    for (const row of bag.values()) {
      num += row.w * row.y
      den += row.w
    }
    if (den > 0) out.push({ x: day, y: Math.round((num / den) * 100) / 100 })
  }
  return out
}

export function weightedTrendV7(points: TrendPoint[], windowDays = 14): SeriesPoint[] {
  if (!points.length) return []
  const sorted = [...points].filter((p) => p.y != null && Number.isFinite(p.y)).sort((a, b) => a.t - b.t)
  if (!sorted.length) return []
  const half = Math.max(3, Number(windowDays) || 14)
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const out: SeriesPoint[] = []
  for (let t = tMin; t <= tMax; t += DAY) {
    let sw = 0
    let sx = 0
    let sy = 0
    let sxx = 0
    let sxy = 0
    let nearest = Infinity
    let nfit = 0
    for (const p of sorted) {
      const days = (p.t - t) / DAY
      const ad = Math.abs(days)
      if (ad < nearest) nearest = ad
      if (ad > half) continue
      const u = ad / half
      const tricube = (1 - u * u * u) ** 3
      const k = tricube * Math.sqrt(sampleN(p.n) / N_REF)
      if (k <= 0) continue
      sw += k
      sx += k * days
      sy += k * p.y
      sxx += k * days * days
      sxy += k * days * p.y
      nfit += 1
    }
    if (sw <= 0 || nearest > half) continue
    const det = sw * sxx - sx * sx
    let y = sy / sw
    if (nfit >= 3 && det > 1e-6) y = (sxx * sy - sx * sxy) / det
    out.push({ x: t, y: Math.round(Math.min(100, Math.max(0, y)) * 100) / 100 })
  }
  return out
}

export function averageTrendAdvanced(points: TrendPoint[], windowDays = 14, model = 3): SeriesPoint[] {
  const m = Number(model)
  if (m === 12) return schoolCenterTrend(points, windowDays, 'trim')
  if (m === 11) return schoolCenterTrend(points, windowDays, 'mode')
  if (m === 10) return schoolCenterTrend(points, windowDays, 'median')
  if (m === 9) return schoolCenterTrend(points, windowDays, 'weight')
  if (m === 8) return schoolCenterTrend(points, windowDays, 'mean')
  if (m === 7) return weightedTrendV7(points, windowDays)
  if (m === 6) return weightedTrendV6(points)
  if (m === 5) return weightedTrendV5(points, windowDays)
  if (m === 4) return weightedTrendV4(points, windowDays)
  return weightedTrendV3(points, windowDays)
}
