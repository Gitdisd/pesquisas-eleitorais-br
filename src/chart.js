import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import zoomPlugin from 'chartjs-plugin-zoom'
import { ptBR } from 'date-fns/locale'
import { CANDIDATES, pointRadiusForN } from './candidates.js'
import { weightedTrend } from './aggregate.js'
import { projectTrend, hexAlpha, ELECTION_ROUND1_MS, ELECTION_ROUND2_MS } from './projection.js'
import { projectTrendV2, rescaleComposition, formatProjSummary } from './projection-v2.js'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin,
)

const DAY_MS = 86400000
const RIGHT_PAD_DAYS = 18

function resolveModel(opts = {}) {
  if (opts.projectionModel != null) return Number(opts.projectionModel)
  if (typeof window !== 'undefined' && window.__pebrProjModel != null) {
    return Number(window.__pebrProjModel)
  }
  return opts.projection ? 1 : 0
}

function themeColors() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  return {
    grid: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
    tick: dark ? '#a8b0ba' : '#5c6570',
    title: dark ? '#e8eaed' : '#1a1d21',
  }
}

function collectYs(polls, round, institutes, showField) {
  const keys = seriesKeys(round, showField)
  const ys = []
  for (const p of polls) {
    if (p.round !== round) continue
    if (institutes?.size && !institutes.has(p.institute)) continue
    for (const c of keys) {
      const y = p.results?.[c.key]
      if (typeof y === 'number') ys.push(y)
    }
  }
  return ys
}

function yScaleForRound(round, polls, institutes, showField) {
  const ys = polls ? collectYs(polls, round, institutes, showField) : []
  if (!ys.length) {
    if (round === 2) return { min: 32, max: 56 }
    return { min: 0, max: 50 }
  }
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const pad = Math.max(3, (hi - lo) * 0.12)
  let min = Math.max(0, Math.floor(lo - pad))
  let max = Math.min(100, Math.ceil(hi + pad))
  if (round === 2) {
    min = Math.max(20, min)
    max = Math.min(75, Math.max(max, min + 12))
  } else if (max - min < 16) {
    const mid = (min + max) / 2
    min = Math.max(0, Math.floor(mid - 8))
    max = Math.min(100, Math.ceil(mid + 8))
  }
  return { min, max }
}

function seriesKeys(round, showField) {
  if (round === 2) return CANDIDATES.filter((c) => c.key === 'lula' || c.key === 'flavio')
  if (showField === false) return CANDIDATES.filter((c) => c.tier === 'lead')
  return CANDIDATES
}

function timeUnitForSpan(min, max) {
  if (min == null || max == null) return 'month'
  const days = (max - min) / 86400000
  if (days <= 45) return 'week'
  return 'month'
}

function hoverBoxFor(chart) {
  const canvas = chart.canvas
  const panel = canvas.closest('.chart-panel') || canvas.parentElement
  let box = panel.querySelector(':scope > .chart-hover')
  if (!box) {
    box = document.createElement('div')
    box.className = 'chart-hover is-empty'
    box.textContent = 'Toque um ponto — a leitura aparece aqui, não em cima do gráfico.'
    const chartBox = canvas.closest('.chart-box') || canvas
    chartBox.parentNode.insertBefore(box, chartBox)
  }
  return box
}

function isOverlaySeries(label) {
  return /\((édia|projeção|modelo|banda)/i.test(label || '')
}
