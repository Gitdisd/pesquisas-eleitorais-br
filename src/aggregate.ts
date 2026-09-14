import { averageTrendAdvanced } from './models/advanced'
import type { SeriesPoint, TrendPoint } from './data/types'

const DAY_MS = 86400000
const N_REF = 2000
const FLOOD_DAYS = 14

function sampleSize(n: unknown): number {
  const rawN = Number(n)
  return Number.isFinite(rawN) && rawN > 0 ? Math.min(8000, Math.max(100, rawN)) : 800
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
      const sample = sampleSize(p.n)
      const w = Math.sqrt(sample / N_REF) * Math.exp(-days / half)
      num += w * p.y
      den += w
    }
    if (den > 0 && nearest <= half) out.push({ x: t, y: Math.round((num / den) * 100) / 100 })
  }
  return out
}

export function pollWeightV2(point: TrendPoint, t: number, halfLifeDays: number, floodCount = 1): number {
  const days = Math.abs(t - point.t) / DAY_MS
  const half = Math.max(1, Number(halfLifeDays) || 14)
  return Math.sqrt(sampleSize(point.n) / N_REF) * Math.pow(2, -days / half) / Math.max(1, floodCount)
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
  const m = Number(model)
  if (m === 3 || m === 4 || m === 5) return averageTrendAdvanced(points, windowDays, m)
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
