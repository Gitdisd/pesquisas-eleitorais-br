/**
 * Overlays visuais estilo TradingView.
 * NAO entram na media dos cartoes nem no modelo do chip.
 * Serie de entrada: [{ x, y }] diaria (a linha do modelo ativo).
 * rawPts [{ t, y, n }] so para VWMA (n = volume).
 */
export const OVERLAY_DEFS = [
  { id: 'sma7', label: 'SMA 7', kind: 'line', dash: [4, 3] },
  { id: 'sma21', label: 'SMA 21', kind: 'line', dash: [8, 4] },
  { id: 'ema9', label: 'EMA 9', kind: 'line', dash: [2, 2] },
  { id: 'ema21', label: 'EMA 21', kind: 'line', dash: [6, 3] },
  { id: 'hma', label: 'HMA 16', kind: 'line', dash: [1, 3] },
  { id: 'vwma', label: 'VWMA 14', kind: 'line', dash: [10, 3] },
  { id: 'kama', label: 'KAMA 10', kind: 'line', dash: [3, 5] },
  { id: 'bb', label: 'Bollinger 20', kind: 'band', dash: [1, 4] },
]

function smaAt(ys, i, len) {
  if (i + 1 < len) return null
  let s = 0
  for (let k = i - len + 1; k <= i; k++) s += ys[k]
  return s / len
}

function emaSeries(ys, len) {
  const a = 2 / (len + 1)
  const out = new Array(ys.length).fill(null)
  let e = ys[0]
  out[0] = e
  for (let i = 1; i < ys.length; i++) {
    e = a * ys[i] + (1 - a) * e
    out[i] = e
  }
  return out
}

function wmaAt(arr, i, len) {
  if (i + 1 < len) return null
  let num = 0
  let den = 0
  for (let k = 0; k < len; k++) {
    const w = k + 1
    num += arr[i - len + 1 + k] * w
    den += w
  }
  return den ? num / den : null
}

function hmaSeries(ys, len = 16) {
  const half = Math.max(2, Math.floor(len / 2))
  const sq = Math.max(2, Math.round(Math.sqrt(len)))
  const raw = ys.map((_, i) => {
    const a = wmaAt(ys, i, half)
    const b = wmaAt(ys, i, len)
    if (a == null || b == null) return null
    return 2 * a - b
  })
  const out = new Array(ys.length).fill(null)
  for (let i = 0; i < ys.length; i++) {
    const slice = []
    for (let k = i; k >= 0 && slice.length < sq; k--) {
      if (raw[k] == null) break
      slice.unshift(raw[k])
    }
    if (slice.length < sq) continue
    out[i] = wmaAt(slice, slice.length - 1, sq)
  }
  return out
}

function kamaSeries(ys, len = 10, fast = 2, slow = 30) {
  const out = new Array(ys.length).fill(null)
  if (ys.length < len + 1) return out
  let kama = ys[len]
  out[len] = kama
  const fastSC = 2 / (fast + 1)
  const slowSC = 2 / (slow + 1)
  for (let i = len + 1; i < ys.length; i++) {
    const change = Math.abs(ys[i] - ys[i - len])
    let vol = 0
    for (let k = i - len + 1; k <= i; k++) vol += Math.abs(ys[k] - ys[k - 1])
    const er = vol > 1e-9 ? change / vol : 0
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2)
    kama = kama + sc * (ys[i] - kama)
    out[i] = kama
  }
  return out
}

function pack(series, values) {
  const out = []
  for (let i = 0; i < series.length; i++) {
    if (values[i] == null || Number.isNaN(values[i])) continue
    out.push({ x: series[i].x, y: Math.round(values[i] * 100) / 100 })
  }
  return out
}

export function computeOverlay(id, series, rawPts = []) {
  if (!series?.length) return { mid: [], high: [], low: [] }
  const ys = series.map((p) => p.y)
  if (id === 'sma7') return { mid: pack(series, ys.map((_, i) => smaAt(ys, i, 7))), high: [], low: [] }
  if (id === 'sma21') return { mid: pack(series, ys.map((_, i) => smaAt(ys, i, 21))), high: [], low: [] }
  if (id === 'ema9') return { mid: pack(series, emaSeries(ys, 9)), high: [], low: [] }
  if (id === 'ema21') return { mid: pack(series, emaSeries(ys, 21)), high: [], low: [] }
  if (id === 'hma') return { mid: pack(series, hmaSeries(ys, 16)), high: [], low: [] }
  if (id === 'kama') return { mid: pack(series, kamaSeries(ys, 10)), high: [], low: [] }
  if (id === 'vwma') {
    const src = (rawPts.length ? rawPts : series.map((p) => ({ t: p.x, y: p.y, n: 1 })))
      .slice()
      .sort((a, b) => (a.t || a.x) - (b.t || b.x))
    const mid = []
    const len = 14
    for (let i = 0; i < src.length; i++) {
      if (i + 1 < len) continue
      let num = 0
      let den = 0
      for (let k = i - len + 1; k <= i; k++) {
        const w = Number(src[k].n) > 0 ? Number(src[k].n) : 800
        num += src[k].y * w
        den += w
      }
      if (den) mid.push({ x: src[i].t || src[i].x, y: Math.round((num / den) * 100) / 100 })
    }
    return { mid, high: [], low: [] }
  }
  if (id === 'bb') {
    const mid = []
    const high = []
    const low = []
    const len = 20
    for (let i = 0; i < ys.length; i++) {
      const m = smaAt(ys, i, 20)
      if (m == null) continue
      let ss = 0
      for (let k = i - len + 1; k <= i; k++) ss += (ys[k] - m) ** 2
      const sd = Math.sqrt(ss / len)
      mid.push({ x: series[i].x, y: Math.round(m * 100) / 100 })
      high.push({ x: series[i].x, y: Math.round((m + 2 * sd) * 100) / 100 })
      low.push({ x: series[i].x, y: Math.round((m - 2 * sd) * 100) / 100 })
    }
    return { mid, high, low }
  }
  return { mid: [], high: [], low: [] }
}

export function readOverlayState() {
  if (typeof window === 'undefined') return {}
  if (window.__pebrOverlays && typeof window.__pebrOverlays === 'object') return window.__pebrOverlays
  try {
    const raw = localStorage.getItem('pebr-overlays')
    window.__pebrOverlays = raw ? JSON.parse(raw) : {}
  } catch {
    window.__pebrOverlays = {}
  }
  return window.__pebrOverlays
}

export function writeOverlayState(next) {
  if (typeof window === 'undefined') return
  window.__pebrOverlays = { ...next }
  try {
    localStorage.setItem('pebr-overlays', JSON.stringify(window.__pebrOverlays))
  } catch {}
}
