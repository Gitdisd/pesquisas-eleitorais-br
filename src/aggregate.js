/** média ponderada: peso = √(n/2000) * exp(-dias/janela) */
export function weightedTrend(points, windowDays = 14) {
  if (!points.length) return []
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const dayMs = 86400000
  const out = []
  for (let t = tMin; t <= tMax; t += dayMs) {
    let num = 0
    let den = 0
    for (const p of sorted) {
      const days = Math.abs(t - p.t) / dayMs
      if (days > windowDays * 2.5) continue
      const sample = Math.max(100, p.n || 2000)
      const w = Math.sqrt(sample / 2000) * Math.exp(-days / windowDays)
      num += w * p.y
      den += w
    }
    if (den > 0) out.push({ x: t, y: Math.round((num / den) * 10) / 10 })
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
  return (Math.round(v * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + '%'
}

/** Δ vs média ponderada em meados de mai/2026 (âncora fixa do agregador) */
export function fmtDelta(v) {
  if (v == null || Number.isNaN(v)) return { text: '—', cls: 'flat' }
  const r = Math.round(v * 10) / 10
  if (Math.abs(r) < 0.05) return { text: '0,0 pp vs mai/2026', cls: 'flat' }
  const sign = r > 0 ? '+' : ''
  return {
    text: `${sign}${r.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp vs mai/2026`,
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

/** Format an ISO last_updated (or Date) for the "Atualizado em" stamp. */
export function formatUpdatedStamp(isoOrDate) {
  if (!isoOrDate) return null
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return null
  return saoPauloStamp(d)
}
