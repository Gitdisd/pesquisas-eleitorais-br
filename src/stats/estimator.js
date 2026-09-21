import { pollWeight } from './contract.js'

export function weightedEstimate(points, { date, candidate, halfLifeDays = 14 } = {}) {
  const rows = (points || []).filter((p) => Number.isFinite(p.y))
  if (!rows.length) return { date, candidate, estimate: null, lower: null, upper: null, effectiveSampleSize: 0 }
  const weights = rows.map((p) => pollWeight(p, date, halfLifeDays).total)
  const den = weights.reduce((a, b) => a + b, 0)
  if (!(den > 0)) return { date, candidate, estimate: null, lower: null, upper: null, effectiveSampleSize: 0 }
  const estimate = weights.reduce((sum, w, i) => sum + w * rows[i].y, 0) / den
  const sumW2 = weights.reduce((sum, w) => sum + w * w, 0)
  return { date, candidate, estimate, lower: null, upper: null, effectiveSampleSize: sumW2 > 0 ? den * den / sumW2 : 0 }
}
