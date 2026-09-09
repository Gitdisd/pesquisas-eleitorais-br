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
import { CANDIDATES } from './candidates.js'
import { weightedTrend } from './aggregate.js'
import { projectTrend, hexAlpha, ELECTION_ROUND1_MS, ELECTION_ROUND2_MS } from './projection.js'

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

function themeColors() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  return {
    grid: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
    tick: dark ? '#a8b0ba' : '#5c6570',
    title: dark ? '#e8eaed' : '#1a1d21',
  }
}

function yScaleForRound(round) {
  if (round === 2) return { min: 30, max: 58, suggestedMin: 30, suggestedMax: 55 }
  return { min: 0, max: undefined, suggestedMin: 0, suggestedMax: 50 }
}

export function createPollChart(canvas, opts) {
  const { polls, round, institutes, windowDays, rangeDays, projection, onZoom } = opts
  const datasets = buildDatasets(polls, round, institutes, windowDays, projection)
  const { min, max } = rangeBounds(polls, round, institutes, rangeDays, projection)
  const tc = themeColors()
  const chart = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 280 },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          filter(item) {
            const lab = item.dataset.label || ''
            return !lab.includes('(banda')
          },
          callbacks: {
            title(items) {
              const x = items[0]?.parsed?.x
              if (!x) return ''
              return new Date(x).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
            },
            label(ctx) {
              const v = ctx.parsed.y
              const base = `${ctx.dataset.label}: ${v?.toLocaleString('pt-BR')}%`
              const meta = ctx.raw?.meta
              if (!meta) return base
              return `${base} · ${meta.institute} (N=${meta.n})`
            },
          },
        },
        zoom: {
          limits: {
            x: { min: 'original', max: 'original' },
            y: { min: 0, max: 100, minRange: 5 },
          },
          pan: {
            enabled: true,
            mode: 'xy',
            modifierKey: null,
            scaleMode: 'xy',
          },
          zoom: {
            wheel: { enabled: true, speed: 0.08 },
            pinch: { enabled: true },
            mode: 'xy',
            scaleMode: 'xy',
            drag: {
              enabled: true,
              backgroundColor: 'rgba(37,99,235,.12)',
              borderColor: 'rgba(37,99,235,.45)',
              borderWidth: 1,
              modifierKey: 'shift',
            },
            onZoomComplete: ({ chart: c }) => onZoom?.(c),
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          adapters: { date: { locale: ptBR } },
          time: { unit: 'month', tooltipFormat: 'dd/MM/yyyy' },
          min: min ?? undefined,
          max: max ?? undefined,
          grid: { color: tc.grid },
          ticks: { maxRotation: 0, autoSkipPadding: 12, color: tc.tick },
        },
        y: {
          title: { display: true, text: 'Intenção de voto (%)', color: tc.title },
          ...yScaleForRound(round),
          grid: { color: tc.grid },
          ticks: { color: tc.tick },
        },
      },
    },
  })
  return chart
}

export function updatePollChart(chart, { polls, round, institutes, windowDays, rangeDays, projection }) {
  chart.data.datasets = buildDatasets(polls, round, institutes, windowDays, projection)
  const tc = themeColors()
  Object.assign(chart.options.scales.y, yScaleForRound(round))
  chart.options.scales.x.grid.color = tc.grid
  chart.options.scales.y.grid.color = tc.grid
  chart.options.scales.x.ticks.color = tc.tick
  chart.options.scales.y.ticks.color = tc.tick
  chart.options.scales.y.title.color = tc.title
  applyDateRange(chart, polls, round, institutes, rangeDays, projection)
  chart.update('none')
}

export function applyThemeToChart(chart) {
  if (!chart) return
  const tc = themeColors()
  chart.options.scales.x.grid.color = tc.grid
  chart.options.scales.y.grid.color = tc.grid
  chart.options.scales.x.ticks.color = tc.tick
  chart.options.scales.y.ticks.color = tc.tick
  chart.options.scales.y.title.color = tc.title
  chart.update('none')
}

export function applyDateRange(chart, polls, round, institutes, rangeDays, projection) {
  const { min, max } = rangeBounds(polls, round, institutes, rangeDays, projection)
  if (min == null || max == null) {
    chart.options.scales.x.min = undefined
    chart.options.scales.x.max = undefined
  } else {
    chart.options.scales.x.min = min
    chart.options.scales.x.max = max
  }
}

function rangeBounds(polls, round, institutes, rangeDays, projection) {
  const filtered = polls.filter((p) => {
    if (p.round !== round) return false
    if (institutes?.size && !institutes.has(p.institute)) return false
    return true
  })
  if (!filtered.length) return { min: null, max: null }
  const tMaxObs = filtered.reduce((m, p) => Math.max(m, p.t), filtered[0].t)
  const tMinAll = filtered.reduce((m, p) => Math.min(m, p.t), filtered[0].t)
  const tMax = projection ? tMaxObs + 14 * DAY_MS : tMaxObs
  if (!rangeDays) return { min: tMinAll, max: tMax }
  const min = Math.max(tMinAll, tMaxObs - rangeDays * DAY_MS)
  return { min, max: tMax }
}

function buildDatasets(polls, round, institutes, windowDays, projection) {
  const filtered = polls.filter((p) => {
    if (p.round !== round) return false
    if (institutes.size && !institutes.has(p.institute)) return false
    return true
  })
  const keys = round === 2 ? CANDIDATES.filter((c) => c.key === 'lula' || c.key === 'flavio') : CANDIDATES
  const datasets = []
  for (const c of keys) {
    const pts = []
    for (const p of filtered) {
      const y = p.results[c.key]
      if (y == null) continue
      pts.push({
        x: p.t,
        y,
        meta: { institute: p.institute, n: p.n, moe: p.moe, url: p.sourceUrl },
      })
    }
    datasets.push({
      label: c.label,
      data: pts,
      showLine: false,
      pointRadius: 3.2,
      pointHoverRadius: 5,
      backgroundColor: c.color,
      borderColor: c.color,
      order: 2,
    })
    const trendPts = pts.map((p) => ({ t: p.x, y: p.y, n: p.meta.n }))
    const trend = weightedTrend(trendPts, windowDays)
    datasets.push({
      label: `${c.label} (média)`,
      data: trend,
      showLine: true,
      pointRadius: 0,
      borderColor: c.color,
      borderWidth: c.borderWidth,
      borderDash: c.borderDash,
      tension: 0.25,
      order: 1,
    })

    if (projection && trend.length >= 2) {
      const electionDayMs = round === 2 ? ELECTION_ROUND2_MS : ELECTION_ROUND1_MS
      const proj = projectTrend(trend, {
        fitDays: windowDays,
        horizonDays: 14,
        electionDayMs,
      })
      if (proj.ok && proj.line.length > 1) {
        datasets.push({
          label: `${c.label} (banda+)`,
          data: proj.bandHigh,
          showLine: true,
          pointRadius: 0,
          borderWidth: 0,
          backgroundColor: hexAlpha(c.color, 0.14),
          borderColor: 'transparent',
          fill: '+1',
          tension: 0.2,
          order: 3,
        })
        datasets.push({
          label: `${c.label} (banda-)`,
          data: proj.bandLow,
          showLine: true,
          pointRadius: 0,
          borderWidth: 0,
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          fill: false,
          tension: 0.2,
          order: 3,
        })
        datasets.push({
          label: `${c.label} (projeção)`,
          data: proj.line,
          showLine: true,
          pointRadius: 0,
          borderColor: c.color,
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.2,
          order: 0,
        })
      }
    }
  }
  return datasets
}

export function resetZoom(chart) {
  chart.resetZoom()
}

export function resetYScale(chart, round) {
  Object.assign(chart.options.scales.y, yScaleForRound(round))
}
