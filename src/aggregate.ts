import { averageTrendAdvanced } from './models/advanced'
import { sampleSize, pollWeight as canonicalPollWeight, DAY_MS, N_REF } from './stats/contract'
import type { SeriesPoint, TrendPoint } from './data/types'

const FLOOD_DAYS = 14
const MAX_MODEL = 12

function resolveLiveModel(model: number): number {
  const m = Number(model)
  try {
    const live = Number((globalThis as { __pebrProjModel?: number }).__pebrProjModel)
    if (Number.isFinite(live) && live >= 0 && live <= MAX_MODEL) return live || 1
  } catch {}
  if (m >= 1 && m <= MAX_MODEL) return m
  return 1
}

export function weightedTrendV1(points: TrendPoint[], windowDays = 14): SeriesPoint[] {
  if (!points.length) return []
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const half = Math.max(1, Number(windowDays) || 14)
  const out: SeriesPoint[] = []
  for (let t = tMin; t <= tMax; t += DAY_MS) {
    let num = 0
    let den = 0
    let nearest = Infinity
    for (const p of sorted) {
      const days = Math.abs(t - p.t) / DAY_MS
      if (days < nearest) nearest = days
      if (days > half * 2.5) continue
      const w = canonicalPollWeight(p, t, half).total
      num += w * p.y
      den += w
    }
    if (den > 0 && nearest <= half) out.push({ x: t, y: Math.round((num / den) * 100) / 100 })
  }
  return out
}

export function pollWeightV2(point: TrendPoint, t: number, halfLifeDays: number, floodCount = 1): number {
  return canonicalPollWeight(point, t, halfLifeDays, floodCount).total
}

function buildFloodIndex(points: TrendPoint[], half: number): Map<string, number> {
  const span = Math.ceil(Math.max(FLOOD_DAYS, half))
  const index = new Map<string, number>()
  for (const p of points) {
    if (!p.institute) continue
    const day = Math.round(p.t / DAY_MS)
    for (let offset = -span; offset <= span; offset += 1) {
      const key = `${p.institute}\u0000${day + offset}`
      index.set(key, (index.get(key) || 0) + 1)
    }
  }
  return index
}

export function weightedTrendV2(points: TrendPoint[], windowDays = 14): SeriesPoint[] {
  if (!points.length) return []
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const half = Math.max(1, Number(windowDays) || 14)
  const reach = half * 2.5
  const floodIndex = buildFloodIndex(sorted, half)
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const out: SeriesPoint[] = []
  for (let t = tMin; t <= tMax; t += DAY_MS) {
    let num = 0
    let den = 0
    let nearest = Infinity
    for (const p of sorted) {
      const days = Math.abs(t - p.t) / DAY_MS
      if (days < nearest) nearest = days
      if (days > reach) continue
      const flood = p.institute ? floodIndex.get(`${p.institute}\u0000${Math.round(t / DAY_MS)}`) || 1 : 1
      const w = pollWeightV2(p, t, half, flood)
      num += w * p.y
      den += w
    }
    if (den > 0 && nearest <= half) out.push({ x: t, y: Math.round((num / den) * 100) / 100 })
  }
  return out
}

export function estimateHouseEffects(points: TrendPoint[], peerDays = 14): Record<string, number> {
  const acc = new Map<string, { s: number; n: number }>()
  for (const p of points) {
    if (p.y == null || !p.institute) continue
    let num = 0
    let den = 0
    for (const q of points) {
      if (q.y == null || !q.institute || q.institute === p.institute) continue
      const days = Math.abs(q.t - p.t) / DAY_MS
      if (days > peerDays) continue
      const w = Math.sqrt(sampleSize(q.n) / N_REF)
      num += w * q.y
      den += w
    }
    if (den <= 0) continue
    const current = acc.get(p.institute) || { s: 0, n: 0 }
    current.s += p.y - num / den
    current.n += 1
    acc.set(p.institute, current)
  }
  const out: Record<string, number> = {}
  for (const [key, value] of acc) {
    const raw = value.s / value.n
    out[key] = Math.abs(raw) < 0.05 ? 0 : raw * (value.n / (value.n + 4))
  }
  return out
}

export function applyHouseEffects(points: TrendPoint[], house: Record<string, number>): TrendPoint[] {
  return points.map((p) => ({ ...p, y: p.y - (house[p.institute || ''] || 0) }))
}

export function averageTrend(points: TrendPoint[], windowDays = 14, model = 1): SeriesPoint[] {
  const m = resolveLiveModel(model)
  if (m >= 3 && m <= MAX_MODEL) return averageTrendAdvanced(points, windowDays, m)
  if (m === 2) return weightedTrendV2(applyHouseEffects(points, estimateHouseEffects(points)), windowDays)
  return weightedTrendV1(points, windowDays)
}

export function weightedTrend(points: TrendPoint[], windowDays = 14): SeriesPoint[] {
  return weightedTrendV1(points, windowDays)
}

export function trendAt(series: SeriesPoint[], dateMs: number): number | null {
  if (!series.length) return null
  let best = series[0]
  let bestD = Math.abs(series[0].x - dateMs)
  for (const point of series) {
    const d = Math.abs(point.x - dateMs)
    if (d < bestD) {
      best = point
      bestD = d
    }
  }
  return best.y ?? null
}

export interface UncertaintyPoint {
  x: number
  low: number
  high: number
  se: number
}

export function uncertaintyBand(points: TrendPoint[], windowDays = 14, z = 1.645): UncertaintyPoint[] {
  if (!points.length) return []
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.y))
    .sort((a, b) => a.t - b.t)
  if (!sorted.length) return []
  const half = Math.max(1, Number(windowDays) || 14)
  const reach = half * 2.5
  const minBand = 0.75
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const out: UncertaintyPoint[] = []

  for (let t = tMin; t <= tMax; t += DAY_MS) {
    const bag: Array<{ y: number; w: number; se: number | null }> = []
    let nearest = Infinity
    for (const p of sorted) {
      const days = Math.abs(t - p.t) / DAY_MS
      if (days < nearest) nearest = days
      if (days > reach) continue
      const sample = sampleSize(p.n)
      const w = Math.sqrt(sample / N_REF) * Math.exp(-days / half)
      const moe = Number(p.moe)
      const se = Number.isFinite(moe) && moe > 0 ? Math.max(0.4, moe / 1.96) : null
      bag.push({ y: p.y, w, se })
    }
    if (nearest > half || !bag.length) continue

    const den = bag.reduce((sum, p) => sum + p.w, 0)
    if (!(den > 0)) continue
    const mu = bag.reduce((sum, p) => sum + p.w * p.y, 0) / den
    const sumW2 = bag.reduce((sum, p) => sum + p.w * p.w, 0)
    const nEff = Math.max(1, (den * den) / Math.max(1e-9, sumW2))
    const betweenVar = bag.reduce((sum, p) => sum + p.w * (p.y - mu) ** 2, 0) / den
    const measurementVar = bag.reduce((sum, p) => sum + p.w * p.w * (p.se || 0) ** 2, 0) / Math.max(1e-9, den * den)
    const se = Math.max(minBand, Math.sqrt(Math.max(0, betweenVar / nEff + measurementVar)))
    const band = Math.max(minBand, z * se)
    const center = Math.round(mu * 100) / 100
    out.push({
      x: t,
      low: Math.round(Math.max(0, center - band) * 100) / 100,
      high: Math.round(Math.min(100, center + band) * 100) / 100,
      se: Math.round(se * 1000) / 1000,
    })
  }
  return out
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  return `${(Math.round(v * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

export function fmtDelta(v: number | null | undefined): { text: string; cls: 'flat' | 'up' | 'down' } {
  if (v == null || Number.isNaN(v)) return { text: '—', cls: 'flat' }
  const r = Math.round(v * 100) / 100
  if (Math.abs(r) < 0.005) return { text: '0,00 pp vs 30d', cls: 'flat' }
  const sign = r > 0 ? '+' : ''
  return {
    text: `${sign}${r.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pp vs 30d`,
    cls: r > 0 ? 'up' : 'down',
  }
}

export function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function saoPauloStamp(date = new Date()): string {
  return `${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(date)} (horário de Brasília)`
}

export function formatUpdatedStamp(isoOrDate: string | Date | null | undefined): string | null {
  if (!isoOrDate) return null
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(date.getTime())) return null
  return saoPauloStamp(date)
}
