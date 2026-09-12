/**
 * Duas médias, mesmo desenho:
 *   Modelo 1 — fórmula anterior: √(n/2000) × exp(−dias/janela)
 *   Modelo 2 — meia-vida + anti-inundação + viés de casa (±14d, encolhido)
 */
const DAY_MS = 86400000
const N_REF = 2000
const FLOOD_DAYS = 14

function sampleSize(n) {
  const rawN = Number(n)
  return Number.isFinite(rawN) && rawN > 0 ? Math.min(8000, Math.max(100, rawN)) : 800
}

/** Fórmula original do agregador (Modelo 1). */
export function weightedTrendV1(points, windowDays = 14) {
  if (!points.length) return []
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const half = Math.max(1, Number(windowDays) || 14)
  const out = []
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
    if (den > 0 && nearest <= half) {
      out.push({ x: t, y: Math.round((num / den) * 100) / 100 })
    }
  }
  return out
}

export function pollWeightV2(point, t, halfLifeDays, floodCount = 1) {
  const days = Math.abs(t - point.t) / DAY_MS
  const half = Math.max(1, Number(halfLifeDays) || 14)
  const sizeW = Math.sqrt(sampleSize(point.n) / N_REF)
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

/** Média nova sem viés de casa (núcleo do Modelo 2). */
export function weightedTrendV2(points, windowDays = 14) {
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
      const w = pollWeightV2(p, t, half, k)
      num += w * p.y
      den += w
    }
    if (den > 0 && nearest <= half) {
      out.push({ x: t, y: Math.round((num / den) * 100) / 100 })
    }
  }
  return out
}

/** Viés da casa vs outras casas em ±peerDays, encolhido n/(n+4). */
export function estimateHouseEffects(points, peerDays = 14) {
  const acc = new Map()
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

export function applyHouseEffects(points, house) {
  return points.map((p) => ({
    ...p,
    y: p.y - (house[p.institute] || 0),
  }))
}

/**
 * model 2 → média nova com viés de casa removido
 * qualquer outro → média antiga (Modelo 1)
 */
export function averageTrend(points, windowDays = 14, model = 1) {
  if (Number(model) === 2) {
    const house = estimateHouseEffects(points)
    return weightedTrendV2(applyHouseEffects(points, house), windowDays)
  }
  return weightedTrendV1(points, windowDays)
}

/** Compat: quem ainda chama weightedTrend recebe Modelo 1. */
export function weightedTrend(points, windowDays = 14) {
  return weightedTrendV1(points, windowDays)
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
