export const DAY_MS = 86400000
export const N_REF = 2000
export const MIN_SAMPLE = 100
export const MAX_SAMPLE = 4000

export function sampleSize(n) {
  const value = Number(n)
  return Number.isFinite(value) && value > 0
    ? Math.min(MAX_SAMPLE, Math.max(MIN_SAMPLE, value))
    : 800
}

export function pollWeight(point, t, halfLifeDays = 14, floodCount = 1) {
  const days = Math.abs(t - point.t) / DAY_MS
  const half = Math.max(1, Number(halfLifeDays) || 14)
  const sample = Math.sqrt(sampleSize(point.n) / N_REF)
  const recency = 2 ** (-days / half)
  const flood = Math.max(1, Number(floodCount) || 1)
  return { total: sample * recency / flood, sample, recency, flood }
}

export function weightedMean(points, t, halfLifeDays = 14) {
  const rows = points.filter((p) => Number.isFinite(p.y))
  if (!rows.length) return null
  let num = 0
  let den = 0
  for (const point of rows) {
    const w = pollWeight(point, t, halfLifeDays).total
    num += w * point.y
    den += w
  }
  return den > 0 ? num / den : null
}
