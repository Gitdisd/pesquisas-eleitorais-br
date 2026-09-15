import type { SeriesPoint, TrendPoint } from '../data/types'

const DAY = 86400000
const N_REF = 2000

export type SchoolKind = 'mean' | 'weight' | 'median' | 'mode' | 'trim'

function sampleN(n: unknown): number {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? Math.min(8000, Math.max(100, v)) : 800
}

function round2(y: number): number {
  return Math.round(Math.min(100, Math.max(0, y)) * 100) / 100
}

function medianOf(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  if (!s.length) return 0
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function modeOf(vals: number[]): number {
  if (!vals.length) return 0
  const bins = new Map<number, number>()
  for (const y of vals) {
    const b = Math.round(y * 2) / 2
    bins.set(b, (bins.get(b) || 0) + 1)
  }
  let best = 0
  const winners: number[] = []
  for (const [b, c] of bins) {
    if (c > best) {
      best = c
      winners.length = 0
      winners.push(b)
    } else if (c === best) winners.push(b)
  }
  if (best <= 1) return medianOf(vals)
  return medianOf(winners)
}

function trimMean(vals: number[]): number {
  if (vals.length < 4) return medianOf(vals)
  const s = [...vals].sort((a, b) => a - b)
  const drop = Math.max(1, Math.floor(s.length * 0.2))
  const core = s.slice(drop, s.length - drop)
  if (!core.length) return medianOf(s)
  return core.reduce((a, b) => a + b, 0) / core.length
}

function collapseDay(points: TrendPoint[]): Array<{ y: number; w: number }> {
  const bag = new Map<string, { y: number; w: number }>()
  for (const p of points) {
    if (p.y == null || !Number.isFinite(p.y)) continue
    const inst = p.institute || '_'
    const w = Math.sqrt(sampleN(p.n) / N_REF)
    const cur = bag.get(inst)
    if (!cur) bag.set(inst, { y: p.y, w })
    else {
      const nw = cur.w + w
      bag.set(inst, { y: (cur.y * cur.w + p.y * w) / nw, w: nw })
    }
  }
  return [...bag.values()]
}

function reduce(rows: Array<{ y: number; w: number }>, kind: SchoolKind): number | null {
  if (!rows.length) return null
  const ys = rows.map((r) => r.y)
  if (kind === 'mean') return ys.reduce((a, b) => a + b, 0) / ys.length
  if (kind === 'weight') {
    let num = 0
    let den = 0
    for (const r of rows) {
      num += r.w * r.y
      den += r.w
    }
    return den > 0 ? num / den : null
  }
  if (kind === 'median') return medianOf(ys)
  if (kind === 'mode') return modeOf(ys)
  return trimMean(ys)
}

export function schoolCenterTrend(points: TrendPoint[], windowDays = 14, kind: SchoolKind = 'mean'): SeriesPoint[] {
  if (!points.length) return []
  const sorted = [...points].filter((p) => p.y != null && Number.isFinite(p.y)).sort((a, b) => a.t - b.t)
  if (!sorted.length) return []
  const half = Math.max(1, Number(windowDays) || 14)
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const out: SeriesPoint[] = []
  for (let t = tMin; t <= tMax; t += DAY) {
    const bag: TrendPoint[] = []
    let nearest = Infinity
    for (const p of sorted) {
      const days = Math.abs(t - p.t) / DAY
      if (days < nearest) nearest = days
      if (days <= half) bag.push(p)
    }
    if (!bag.length || nearest > half) continue
    const y = reduce(collapseDay(bag), kind)
    if (y == null || !Number.isFinite(y)) continue
    out.push({ x: t, y: round2(y) })
  }
  return out
}
