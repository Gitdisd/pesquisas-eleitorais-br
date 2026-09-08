/**
 * Modo projeção — tendência linear local amortecida sobre a média ponderada,
 * com horizonte limitado ao turno e bandas que alargam.
 *
 * Estimativa de modelo sobre a *média*, não pesquisa nova, não P(vitória),
 * não prognóstico de urna. Ver docs/modo-projecao-math.md.
 */

const DAY_MS = 86400000

/** 1º turno Eleições 2026 (TSE). */
export const ELECTION_ROUND1_MS = Date.parse('2026-10-04T12:00:00Z')
/** Eventual 2º turno. */
export const ELECTION_ROUND2_MS = Date.parse('2026-10-25T12:00:00Z')

export const PROJECTION_DEFAULTS = Object.freeze({
  fitDays: 14,
  horizonDays: 14,
  minPoints: 4,
  maxAbsSlope: 0.25, // pp / dia
  dampTauDays: 10,
  z: 1.645, // ~90%
  bandFloor: 2.0, // pp
  processSd: 0.12, // pp / √dia
})

/**
 * @param {{x:number,y:number}[]} series daily weighted-average points
 * @param {object} [opts]
 * @param {number} [opts.fitDays]
 * @param {number} [opts.horizonDays]
 * @param {number|null} [opts.electionDayMs] hard stop (inclusive day of vote)
 * @param {number} [opts.minPoints]
 * @param {number} [opts.maxAbsSlope]
 * @param {number} [opts.dampTauDays]
 * @param {number} [opts.z]
 * @param {number} [opts.bandFloor]
 * @param {number} [opts.processSd]
 * @returns {{
 *   ok: boolean,
 *   reason: string|null,
 *   line: {x:number,y:number}[],
 *   bandLow: {x:number,y:number}[],
 *   bandHigh: {x:number,y:number}[],
 *   lastObserved: number|null,
 *   slope: number|null,
 *   rmse: number|null,
 *   horizonUsed: number
 * }}
 */
export function projectTrend(series, opts = {}) {
  const fitDays = clamp(Math.round(opts.fitDays ?? PROJECTION_DEFAULTS.fitDays), 7, 28)
  const horizonCap = Math.max(1, Math.round(opts.horizonDays ?? PROJECTION_DEFAULTS.horizonDays))
  const minPoints = Math.max(2, opts.minPoints ?? PROJECTION_DEFAULTS.minPoints)
  const maxAbsSlope = opts.maxAbsSlope ?? PROJECTION_DEFAULTS.maxAbsSlope
  const dampTauDays = Math.max(1, opts.dampTauDays ?? PROJECTION_DEFAULTS.dampTauDays)
  const z = opts.z ?? PROJECTION_DEFAULTS.z
  const bandFloor = opts.bandFloor ?? PROJECTION_DEFAULTS.bandFloor
  const processSd = opts.processSd ?? PROJECTION_DEFAULTS.processSd
  const electionDayMs = opts.electionDayMs ?? null

  const empty = (reason) => ({
    ok: false,
    reason,
    line: [],
    bandLow: [],
    bandHigh: [],
    lastObserved: null,
    slope: null,
    rmse: null,
    horizonUsed: 0,
  })

  if (!series?.length) return empty('empty_series')

  const sorted = [...series].sort((a, b) => a.x - b.x)
  const tLast = sorted[sorted.length - 1].x
  const yLast = sorted[sorted.length - 1].y
  const tCut = tLast - fitDays * DAY_MS
  const window = sorted.filter((p) => p.x >= tCut)

  if (window.length < minPoints) {
    return { ...empty('insufficient_points'), lastObserved: tLast }
  }

  let daysToElection = Infinity
  if (electionDayMs != null && Number.isFinite(electionDayMs)) {
    daysToElection = Math.floor((electionDayMs - tLast) / DAY_MS)
    if (daysToElection < 1) {
      return { ...empty('past_or_on_election'), lastObserved: tLast }
    }
  }
  const horizonDays = Math.min(horizonCap, daysToElection === Infinity ? horizonCap : daysToElection)
  if (horizonDays < 1) {
    return { ...empty('horizon_zero'), lastObserved: tLast }
  }

  const t0 = window[0].x
  let sumT = 0
  let sumY = 0
  let sumTT = 0
  let sumTY = 0
  const n = window.length
  for (const p of window) {
    const t = (p.x - t0) / DAY_MS
    sumT += t
    sumY += p.y
    sumTT += t * t
    sumTY += t * p.y
  }
  const den = n * sumTT - sumT * sumT
  let b = den === 0 ? 0 : (n * sumTY - sumT * sumY) / den
  const a = (sumY - b * sumT) / n
  b = clip(b, -maxAbsSlope, maxAbsSlope)

  let sse = 0
  for (const p of window) {
    const t = (p.x - t0) / DAY_MS
    const e = p.y - (a + b * t)
    sse += e * e
  }
  const rmse = Math.sqrt(sse / Math.max(1, n - 2))

  const line = [{ x: tLast, y: round1(yLast) }]
  const bandLow = [{ x: tLast, y: round1(yLast) }]
  const bandHigh = [{ x: tLast, y: round1(yLast) }]

  for (let d = 1; d <= horizonDays; d++) {
    const x = tLast + d * DAY_MS
    // Tendência amortecida: Δ(d) = b * λ * (1 - e^{-d/λ})
    const delta = b * dampTauDays * (1 - Math.exp(-d / dampTauDays))
    const y = clip(yLast + delta, 0, 100)
    const widen =
      z *
      Math.sqrt(
        rmse * rmse * (1 + d / fitDays) + bandFloor * bandFloor + processSd * processSd * d,
      )
    line.push({ x, y: round1(y) })
    bandLow.push({ x, y: round1(clip(y - widen, 0, 100)) })
    bandHigh.push({ x, y: round1(clip(y + widen, 0, 100)) })
  }

  return {
    ok: true,
    reason: null,
    line,
    bandLow,
    bandHigh,
    lastObserved: tLast,
    slope: b,
    rmse,
    horizonUsed: horizonDays,
  }
}

/** Hex → rgba with alpha for band fill */
export function hexAlpha(hex, alpha) {
  const h = String(hex).replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Copy pt-BR para o toggle / disclaimers (Frontend).
 * Manter strings estáveis para i18n futura.
 */
export const PROJECTION_COPY_PT = Object.freeze({
  toggleLabel: 'Modo projeção',
  toggleAria: 'Ativar extrapolação da tendência recente da média (estimativa de modelo)',
  chipOn: 'Projeção ligada',
  chartHint:
    'Linha tracejada = extrapolação amortecida da média ponderada recente, não uma pesquisa nova. A faixa indica incerteza do modelo (estimativa). Não é prognóstico de urna nem probabilidade de vitória.',
  methodology:
    'O Modo projeção estende a tendência recente da nossa média ponderada por poucos dias, com amortecimento e faixa de incerteza. É uma estimativa de modelo a partir de pesquisas já publicadas — não prevê o resultado da eleição e não substitui as pesquisas.',
  unavailable: 'Projeção indisponível: poucas pesquisas recentes nesta série.',
  seriesSuffix: 'projeção',
})

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function clip(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function round1(v) {
  return Math.round(v * 10) / 10
}
