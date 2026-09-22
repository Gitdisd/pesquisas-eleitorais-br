import { DAY_MS, N_REF, sampleSize } from './contract.js'

/**
 * @returns {Record<string, number>}
 * Estimate per-institute house effects against contemporaneous peers.
 *
 * This preserves the existing production formula while giving aggregate,
 * advanced-model, and projection-v2 callers one authoritative implementation.
 */
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
    const current = acc.get(p.institute) || { s: 0, n: 0 }
    current.s += p.y - num / den
    current.n += 1
    acc.set(p.institute, current)
  }
  const out = {}
  for (const [key, value] of acc) {
    const raw = value.s / value.n
    out[key] = Math.abs(raw) < 0.05 ? 0 : raw * (value.n / (value.n + 4))
  }
  return out
}
