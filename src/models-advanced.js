/**
 * Modelo 3 — meta-análise de efeitos aleatórios (DerSimonian–Laird)
 *   Cada pesquisa tem erro amostral σ_i (margem/1,96 ou √[p(1-p)/n] × deff).
 *   τ² captura que as pesquisas NÃO medem a mesma coisa (modo, peso, geografia).
 *   peso = recência / (σ_i² + τ²). Atlas n=5000 não come o gráfico sozinho.
 *
 * Modelo 4 — filtro de Kalman + smoother (intenção latente)
 *   θ_t = θ_{t-1} + ruído de processo
 *   y_i = θ_{t_i} + house_i + erro amostral
 *   A linha é a trajetória suavizada da corrida, não um ponto-a-ponto.
 */
const DAY = 86400000
const DEFF = 1.3

function sampleN(n) {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? Math.min(8000, Math.max(100, v)) : 800
}

export function pollSE(p) {
  const moe = Number(p.moe)
  if (Number.isFinite(moe) && moe > 0) return Math.max(0.4, moe / 1.96)
  const n = sampleN(p.n)
  const y = Math.min(95, Math.max(5, Number(p.y) || 30))
  return Math.max(0.5, DEFF * Math.sqrt((y * (100 - y)) / n))
}

function recencyW(days, half) {
  return Math.pow(2, -Math.max(0, days) / Math.max(1, half))
}

function floodK(points, inst, t, half) {
  if (!inst) return 1
  let k = 0
  for (const p of points) {
    if (p.institute !== inst) continue
    if (Math.abs(t - p.t) / DAY <= Math.max(14, half)) k += 1
  }
  return Math.max(1, k)
}

export function dlTau2(items) {
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

function houseMap(points) {
  const acc = new Map()
  for (const p of points) {
    if (p.y == null || !p.institute) continue
    let num = 0
    let den = 0
    for (const q of points) {
      if (q.y == null || !q.institute || q.institute === p.institute) continue
      if (Math.abs(q.t - p.t) / DAY > 14) continue
      const w = Math.sqrt(sampleN(q.n) / 2000)
      num += w * q.y
      den += w
    }
    if (den <= 0) continue
    if (!acc.has(p.institute)) acc.set(p.institute, { s: 0, n: 0 })
    const a = acc.get(p.institute)
    a.s += p.y - num / den
    a.n += 1
  }
  const out = {}
  for (const [k, v] of acc) {
    const raw = v.s / v.n
    out[k] = Math.abs(raw) < 0.05 ? 0 : raw * (v.n / (v.n + 4))
  }
  return out
}

export function weightedTrendV3(points, windowDays = 14) {
  if (!points.length) return []
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const half = Math.max(1, Number(windowDays) || 14)
  const reach = half * 2.5
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const out = []
  for (let t = tMin; t <= tMax; t += DAY) {
    const bag = []
    let nearest = Infinity
    for (const p of sorted) {
      const days = Math.abs(t - p.t) / DAY
      if (days < nearest) nearest = days
      if (days > reach) continue
      bag.push({
        y: p.y,
        se: pollSE(p),
        rw: recencyW(days, half) / floodK(sorted, p.institute, t, half),
      })
    }
    if (!bag.length || nearest > half) continue
    const tau2 = dlTau2(bag.map((b) => ({ y: b.y, se: b.se })))
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

export function weightedTrendV4(points, windowDays = 14) {
  if (!points.length) return []
  const house = houseMap(points)
  const sorted = [...points]
    .map((p) => ({ ...p, y: p.y - (house[p.institute] || 0) }))
    .sort((a, b) => a.t - b.t)
  const tMin = sorted[0].t
  const tMax = sorted[sorted.length - 1].t
  const q = 0.16 * 0.16
  const byDay = new Map()
  for (const p of sorted) {
    const d = Math.round(p.t / DAY)
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d).push(p)
  }
  let theta = sorted[0].y
  let P = 9
  const fwd = []
  for (let t = tMin; t <= tMax; t += DAY) {
    P = P + q
    const bucket = byDay.get(Math.round(t / DAY)) || []
    for (const p of bucket) {
      const R = pollSE(p) * pollSE(p)
      const K = P / (P + R)
      theta = theta + K * (p.y - theta)
      P = (1 - K) * P
    }
    fwd.push({ x: t, m: theta, P })
  }
  const n = fwd.length
  const sm = new Array(n)
  sm[n - 1] = { m: fwd[n - 1].m, P: fwd[n - 1].P }
  for (let i = n - 2; i >= 0; i--) {
    const pPred = fwd[i].P + q
    const C = fwd[i].P / Math.max(1e-9, pPred)
    const m = fwd[i].m + C * (sm[i + 1].m - fwd[i].m)
    sm[i] = { m, P: fwd[i].P + C * C * (sm[i + 1].P - pPred) }
  }
  return sm.map((s, i) => ({
    x: fwd[i].x,
    y: Math.round(Math.min(100, Math.max(0, s.m)) * 100) / 100,
  }))
}

export function averageTrendAdvanced(points, windowDays = 14, model = 3) {
  if (Number(model) === 4) return weightedTrendV4(points, windowDays)
  return weightedTrendV3(points, windowDays)
}
