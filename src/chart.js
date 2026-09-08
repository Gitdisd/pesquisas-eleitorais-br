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

export function createPollChart(canvas, { polls, round, institutes, windowDays, rangeDays, onZoom }) {
  const datasets = buildDatasets(polls, round, institutes, windowDays)
  const { min, max } = rangeBounds(polls, round, institutes, rangeDays)
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
          limits: { x: { min: 'original', max: 'original' } },
          pan: { enabled: true, mode: 'x', modifierKey: null },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x',
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
          grid: { color: 'rgba(0,0,0,.06)' },
          ticks: { maxRotation: 0, autoSkipPadding: 12 },
        },
        y: {
          title: { display: true, text: 'Intenção de voto (%)' },
          suggestedMin: 0,
          suggestedMax: round === 2 ? 55 : 50,
          grid: { color: 'rgba(0,0,0,.06)' },
        },
      },
    },
  })
  return chart
}

export function updatePollChart(chart, { polls, round, institutes, windowDays, rangeDays }) {
  chart.data.datasets = buildDatasets(polls, round, institutes, windowDays)
  chart.options.scales.y.suggestedMax = round === 2 ? 55 : 50
  applyDateRange(chart, polls, round, institutes, rangeDays)
  chart.update('none')
}

export function applyDateRange(chart, polls, round, institutes, rangeDays) {
  const { min, max } = rangeBounds(polls, round, institutes, rangeDays)
  if (min == null || max == null) {
    chart.options.scales.x.min = undefined
    chart.options.scales.x.max = undefined
  } else {
    chart.options.scales.x.min = min
    chart.options.scales.x.max = max
  }
}

function rangeBounds(polls, round, institutes, rangeDays) {
  const filtered = polls.filter((p) => {
    if (p.round !== round) return false
    if (institutes?.size && !institutes.has(p.institute)) return false
    return true
  })
  if (!filtered.length) return { min: null, max: null }
  const tMax = filtered.reduce((m, p) => Math.max(m, p.t), filtered[0].t)
  const tMinAll = filtered.reduce((m, p) => Math.min(m, p.t), filtered[0].t)
  if (!rangeDays) return { min: tMinAll, max: tMax }
  const min = Math.max(tMinAll, tMax - rangeDays * DAY_MS)
  return { min, max: tMax }
}

function buildDatasets(polls, round, institutes, windowDays) {
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
  }
  return datasets
}

export function resetZoom(chart) {
  chart.resetZoom()
}
