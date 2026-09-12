/**
 * Média ponderada estilo agregador:
 *   peso = √(n / 2000) × 2^(−dias / meiaVida) × 1/k_instituto
 *
 * meiaVida = windowDays (chip 7d / 14d / 30d).
 * k_instituto = quantas pesquisas daquela casa caem na janela do dia
 *   (evita um instituto inundar a média).
 * Não inventa números; só combina pesquisas já publicadas.
 */
const DAY_MS = 86400000
const N_REF = 2000
const FLOOD_DAYS = 14

export function pollWeight(point, t, halfLifeDays, floodCount = 1) {
  const days = Math.abs(t - point.t) / DAY_MS
  const half = Math.max(1, Number(halfLifeDays) || 14)
  const rawN = Number(point.n)
  const sample = Number.isFinite(rawN) && rawN > 0 ? Math.min(8000, Math.max(100, rawN)) : 800
  const sizeW = Math.sqrt(sample / N_REF)
  const recencyW = Math.pow(2, -days / half)
  const floodW = 1 / Math.max(1, floodCount)
  return sizeW * recencyW * floodW
}

function floodCountFor(points, target, t, halfLifeDays) {
  const half = Math.max(1, Number(halfLifeDays) || 14)
  const inst = target.institute
  if (!inst) return 1
  let k = 0
  for (const p of points) {
    if (p.institute !== inst) continue
    const days = Math.abs(t - p.t) / DAY_MS
    if (days <= Math.max(FLOOD_DAYS, half)) k += 1
  }
  return Math.max(1, k)
}

export function weightedTrend(points, windowDays = 14) {
  if (!points.length) return []
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const half = Math.max(1, Number(windowDays) || 14)
  const reach = half * 2.5
  const out = []
  for (let t = tMin; t <= tMax; t += DAY_MS) {
    let num = 0
    let den = 0
    let nearest = Infinity
    for (const p of sorted) {
      const days = Math.abs(t - p.t) / DAY_MS
      if (days < nearest) nearest = days
      if (days > reach) continue
      const k = floodCountFor(sorted, p, t, half)
      const w = pollWeight(p, t, half, k)
      num += w * p.y
      den += w
    }
    if (den > 0 && nearest <= half) {
      out.push({ x: t, y: Math.round((num / den) * 100) / 100 })
    }
  }
  return out
}

export function trendAt(series, dateMs) {
  if (!series.length) return null
  let best = series[0]
  let bestD = Math.abs(series[0].x - dateMs)
  for (const p of series) {
    const d = Math.abs(p.x - dateMs)
    if (d < bestD) {
      best = p
      bestD = d
    }
  }
  return best?.y ?? null
}

export function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return (
    (Math.round(v * 100) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '%'
  )
}

/** Δ vs a média no mesmo kernel, 30 dias antes do último ponto. */
export function fmtDelta(v) {
  if (v == null || Number.isNaN(v)) return { text: '—', cls: 'flat' }
  const r = Math.round(v * 100) / 100
  if (Math.abs(r) < 0.005) return { text: '0,00 pp vs 30d', cls: 'flat' }
  const sign = r > 0 ? '+' : ''
  return {
    text: `${sign}${r.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pp vs 30d`,
    cls: r > 0 ? 'up' : 'down',
  }
}

export function fmtDateBR(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function saoPauloStamp(date = new Date()) {
  return (
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date) + ' (horário de Brasília)'
  )
}

export function formatUpdatedStamp(isoOrDate) {
  if (!isoOrDate) return null
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return null
  return saoPauloStamp(d)
}
