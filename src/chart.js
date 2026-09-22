import * as echarts from 'echarts'
import { CANDIDATES } from './candidates.js'
import { averageTrend, uncertaintyBand } from './aggregate.js'
import { OVERLAY_DEFS, computeOverlay, readOverlayState } from './overlays.js'
import { projectTrend, hexAlpha, ELECTION_ROUND1_MS, ELECTION_ROUND2_MS } from './projection.js'
import { projectTrendV2, rescaleComposition, formatProjSummary } from './projection-v2.js'
import { exposeE2E } from './e2e-hooks.js'

const DAY_MS = 86400000
const OBSERVED_PAD_DAYS = 1.5
function resolveModel(opts = {}) {
  if (opts.projectionModel != null) return Number(opts.projectionModel)
  if (typeof window !== 'undefined' && window.__pebrProjModel != null) return Number(window.__pebrProjModel)
  return opts.projection ? 1 : 0
}

function themeColors() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  return {
    grid: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
    tick: dark ? '#a8b0ba' : '#5c6570',
    title: dark ? '#e8eaed' : '#1a1d21',
    panel: dark ? '#15181d' : '#ffffff',
    text: dark ? '#e8eaed' : '#1a1d21',
  }
}

function fmtVote(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function rangeBounds(polls, round, institutes, rangeDays, projection) {
  const filtered = polls.filter((p) => p.round === round && (!institutes?.size || institutes.has(p.institute)))
  if (!filtered.length) return { min: null, max: null }
  const tMaxObs = Math.max(...filtered.map((p) => p.t))
  const tMinAll = Math.min(...filtered.map((p) => p.t))
  const max = tMaxObs + (projection ? 15 : OBSERVED_PAD_DAYS) * DAY_MS
  const min = !rangeDays ? tMinAll : Math.max(tMinAll, tMaxObs - rangeDays * DAY_MS)
  return { min, max }
}

function yScaleForRound(round, series) {
  const values = []
  for (const s of series || []) for (const p of s.data || []) {
    const v = Array.isArray(p) ? p[1] : p?.value?.[1]
    if (Number.isFinite(v)) values.push(v)
  }
  if (round === 2) {
    const lo = values.length ? Math.min(...values) : 0
    const hi = values.length ? Math.max(...values) : 60
    return { min: Math.max(0, Math.floor(lo - 2)), max: Math.min(100, Math.ceil(hi + 2)) }
  }
  const hi = values.length ? Math.max(...values) : 50
  return { min: 0, max: Math.min(100, Math.max(50, Math.ceil(hi + 3))) }
}

function lineData(series) {
  return (series || []).map((p) => [p.x, p.y])
}

function hoverBoxFor(el) {
  const panel = el.closest('.chart-panel') || el.parentElement
  let box = panel.querySelector(':scope > .chart-hover')
  if (!box) {
    box = document.createElement('div')
    box.className = 'chart-hover is-empty'
    box.textContent = 'Toque um ponto — a leitura aparece aqui, não em cima do gráfico.'
    const chartBox = el.closest('.chart-box') || el
    chartBox.parentNode.insertBefore(box, chartBox)
  }
  return box
}

function setExternalHover(el, params) {
  const box = hoverBoxFor(el)
  const chart = echarts.getInstanceByDom(el)
  const optionSeries = chart?.getOption()?.series || []
  const rows = (params || []).filter((p) => {
    const role = optionSeries[p.seriesIndex]?.seriesRole
    return role === 'poll' || role === 'aggregate'
  })
  if (!rows.length) {
    box.classList.add('is-empty')
    box.textContent = 'Toque um ponto — a leitura aparece aqui, não em cima do gráfico.'
    return
  }
  const date = rows[0]?.value?.[0]
  const dateText = date ? new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''
  const html = rows.map((p) => {
    const meta = p.data?.meta || {}
    const extra = meta.institute ? ' · ' + escapeHtml(meta.institute) : ''
    const pub = meta.published ? ' · publicado ' + escapeHtml(meta.published.split('-').reverse().join('/')) : ''
    const tse = meta.tse ? ' · ' + escapeHtml(meta.tse) : ''
    return '<span class="ch-row"><i style="background:' + escapeHtml(p.color || '#888') + '"></i>' +
      escapeHtml(p.seriesName) + ': ' + fmtVote(p.value?.[1]) + '%' + extra + pub + tse + '</span>'
  }).join('')
  box.classList.remove('is-empty')
  box.innerHTML = '<span class="ch-date">' + dateText + '</span>' + html
}

function pushUncertainty(series, c, band) {
  if (!band.length) return
  const low = band.map((p) => [p.x, p.low])
  const delta = band.map((p) => [p.x, Math.max(0, p.high - p.low)])
  series.push({
    id: c.key + '-uncertainty-low', name: c.label + ' — lower uncertainty', seriesRole: 'uncertainty',
    type: 'line', data: low, stack: c.key + '-uncertainty', symbol: 'none',
    lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, tooltip: { show: false }, z: 1,
  })
  series.push({
    id: c.key + '-uncertainty-band', name: c.label + ' — estimated uncertainty band', seriesRole: 'uncertainty',
    type: 'line', data: delta, stack: c.key + '-uncertainty', symbol: 'none',
    lineStyle: { opacity: 0 }, areaStyle: { color: hexAlpha(c.color, 0.10) }, tooltip: { show: false }, z: 1,
  })
}

function pushProjection(series, c, proj, tag) {
  if (!proj.ok || proj.line.length <= 1) return
  const low = proj.bandLow.map((p) => [p.x, p.y])
  const delta = proj.bandHigh.map((p, i) => [p.x, Math.max(0, p.y - (proj.bandLow[i]?.y ?? p.y))])
  series.push({
    id: c.key + '-projection-low', name: c.label + ' — projection lower', seriesRole: 'projection',
    type: 'line', data: low, stack: c.key + '-projection', symbol: 'none',
    lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, tooltip: { show: false }, z: 2,
  })
  series.push({
    id: c.key + '-projection-band', name: c.label + ' — projection band', seriesRole: 'projection',
    type: 'line', data: delta, stack: c.key + '-projection', symbol: 'none',
    lineStyle: { opacity: 0 }, areaStyle: { color: hexAlpha(c.color, 0.14) }, tooltip: { show: false }, z: 2,
  })
  series.push({
    id: c.key + '-projection-line', name: c.label + ' (' + tag + ')', seriesRole: 'projection',
    type: 'line', data: lineData(proj.line), symbol: 'none',
    lineStyle: { color: c.color, width: 2, type: tag === 'modelo 2' ? 'dotted' : 'dashed' }, z: 3,
  })
}

function buildOption(polls, round, institutes, windowDays, model, rangeDays, aggregate, hoverTarget, regional = false) {
  const filtered = polls.filter((p) => p.round === round && (!institutes?.size || institutes.has(p.institute)))
  const keys = round === 2
    ? CANDIDATES.filter((c) => c.key === 'lula' || c.key === 'flavio' || c.key === 'branco_nulo')
    : CANDIDATES
  const series = []
  const projByKey = {}
  const electionDayMs = round === 2 ? ELECTION_ROUND2_MS : ELECTION_ROUND1_MS
  const ovState = readOverlayState()

  for (const c of keys) {
    const pts = filtered.filter((p) => p.results[c.key] != null).map((p) => ({
      value: [p.t, p.results[c.key]],
      meta: { institute: p.institute, n: p.n, moe: p.moe, url: p.sourceUrl, published: p.published, tse: p.tse, fieldworkStart: p.fieldworkStart, fieldworkEnd: p.fieldworkEnd },
    }))
    series.push({
      id: c.key + '-polls', name: c.label, seriesRole: 'poll', type: 'scatter', data: pts,
      symbolSize: 8, itemStyle: { color: c.color }, z: 4,
    })
    const trendPts = pts.map((p) => ({ t: p.value[0], y: p.value[1], n: p.meta.n, institute: p.meta.institute, moe: p.meta.moe }))
    const trend = aggregate ? averageTrend(trendPts, windowDays, model) : []
    if (aggregate) pushUncertainty(series, c, uncertaintyBand(trendPts, windowDays))
    if (aggregate) series.push({
      id: c.key + '-aggregate', name: c.label + ' (média)', seriesRole: 'aggregate', type: 'line',
      data: lineData(trend), symbol: 'none', smooth: 0.2,
      lineStyle: { color: c.color, width: c.borderWidth || 2, type: c.borderDash?.length ? 'dashed' : 'solid' }, z: 5,
    })

    if (aggregate) for (const def of OVERLAY_DEFS) {
      if (!ovState[def.id]) continue
      const ov = computeOverlay(def.id, trend, trendPts)
      if (def.kind === 'band' && ov.high.length) {
        series.push({
          id: c.key + '-' + def.id + '-high', name: c.label + ' (' + def.label + '+)', seriesRole: 'overlay',
          type: 'line', data: lineData(ov.high), symbol: 'none',
          lineStyle: { color: hexAlpha(c.color, 0.35), width: 1 }, areaStyle: { color: hexAlpha(c.color, 0.08) }, z: 2,
        })
        series.push({
          id: c.key + '-' + def.id + '-low', name: c.label + ' (' + def.label + '-)', seriesRole: 'overlay',
          type: 'line', data: lineData(ov.low), symbol: 'none', lineStyle: { opacity: 0 }, tooltip: { show: false }, z: 2,
        })
      } else if (ov.mid.length) {
        series.push({
          id: c.key + '-' + def.id + '-mid', name: c.label + ' (' + def.label + ')', seriesRole: 'overlay',
          type: 'line', data: lineData(ov.mid), symbol: 'none',
          lineStyle: { color: hexAlpha(c.color, 0.72), width: 1, type: def.dash ? 'dashed' : 'solid' }, z: 2,
        })
      }
    }

    if (aggregate && model === 1 && trend.length >= 2) {
      projByKey[c.key] = projectTrend(trend, { fitDays: windowDays, horizonDays: 14, electionDayMs })
    }
    if (aggregate && model === 2 && trendPts.length >= 4) {
      projByKey[c.key] = projectTrendV2(trendPts, { fitDays: windowDays, horizonDays: 14, electionDayMs })
    }
  }

  if (aggregate && model === 2) {
    const lead = keys.filter((c) => c.tier !== 'field').map((c) => c.key)
    rescaleComposition(projByKey, lead.length ? lead : keys.map((c) => c.key))
  }

  const tag = model === 2 ? 'modelo 2' : 'projeção'
  for (const c of keys) if (projByKey[c.key]) pushProjection(series, c, projByKey[c.key], tag)

  if (typeof window !== 'undefined') {
    const labels = Object.fromEntries(CANDIDATES.map((c) => [c.key, c.label.split(' ')[0]]))
    window.__pebrProjSummary = model === 0 ? '' : formatProjSummary(projByKey, labels) || ''
    window.__pebrLastProjByKey = projByKey
    const el = document.getElementById('projSummary')
    if (el) el.textContent = window.__pebrProjSummary
  }

  const bounds = rangeBounds(polls, round, institutes, rangeDays, model > 0)
  const tc = themeColors()
  const ys = yScaleForRound(round, series)
  return {
    animation: { duration: 180 },
    backgroundColor: 'transparent',
    aria: {
      show: true,
      description: regional ? 'Gráfico de pesquisas de todas as fontes, incluindo pesquisas nacionais e estaduais.' : 'Evolução da intenção de voto ao longo do tempo. Pontos representam pesquisas individuais; linhas representam a média ponderada.',
    },
    grid: { left: 52, right: 18, top: 18, bottom: 72, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', snap: false },
      backgroundColor: tc.panel,
      borderColor: tc.grid,
      textStyle: { color: tc.text },
      formatter: function (params) { setExternalHover(hoverTarget, params); return '' },
    },
    legend: { show: false },
    xAxis: {
      type: 'time', min: bounds.min ?? undefined, max: bounds.max ?? undefined,
      axisLabel: { color: tc.tick }, axisLine: { lineStyle: { color: tc.grid } },
      splitLine: { lineStyle: { color: tc.grid } }, axisPointer: { label: { show: true } },
    },
    yAxis: {
      type: 'value', min: ys.min, max: ys.max, name: 'Intenção de voto (%)',
      nameTextStyle: { color: tc.title },
      axisLabel: { color: tc.tick, formatter: (v) => fmtVote(v) },
      splitLine: { lineStyle: { color: tc.grid } },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true, pinch: true },
      { type: 'slider', xAxisIndex: 0, height: 22, bottom: 22, borderColor: tc.grid, backgroundColor: tc.panel, fillerColor: 'rgba(100,130,180,.18)', handleStyle: { opacity: 0.75 }, textStyle: { color: tc.tick } },
    ],
    series,
  }
}

export function createPollChart(canvas, opts) {
  const container = canvas.parentElement || canvas
  canvas.style.display = 'none'
  container.classList.add('echarts-container')
  container.setAttribute('role', 'img')
  container.setAttribute('aria-label', opts?.regional
    ? 'Gráfico de pesquisas de todas as fontes'
    : 'Evolução da intenção de voto nas pesquisas nacionais')
  const chart = echarts.init(container, null, { renderer: 'canvas', useDirtyRect: true })
  exposeE2E(canvas.id === 'allSourcesChart' ? 'regionalChart' : 'nationalChart', chart)
  chart.setOption(buildOption(opts.polls, opts.round, opts.institutes, opts.windowDays, resolveModel(opts), opts.rangeDays, opts.aggregate !== false, container, opts.regional === true))
  chart.on('datazoom', () => opts.onZoom?.(chart))
  hoverBoxFor(container)
  window.addEventListener('resize', () => chart.resize())
  return chart
}

export function updatePollChart(chart, opts) {
  if (!chart) return
  const previousOption = chart.getOption()
  const previousZoom = (previousOption?.dataZoom || [])
    .find((z) => z?.xAxisIndex === 0 && (
      z.startValue != null || z.endValue != null || z.start != null || z.end != null
    ))
  const previousLegendSelected = previousOption?.legend?.[0]?.selected
  chart.setOption(buildOption(opts.polls, opts.round, opts.institutes, opts.windowDays, resolveModel(opts), opts.rangeDays, opts.aggregate !== false, chart.getDom(), opts.regional === true), true)
  if (previousLegendSelected && typeof previousLegendSelected === 'object') {
    for (const [name, selected] of Object.entries(previousLegendSelected)) {
      chart.dispatchAction({ type: selected ? 'legendSelect' : 'legendUnSelect', name })
    }
  }
  if (previousZoom) {
    const action = previousZoom.startValue != null || previousZoom.endValue != null
      ? {
          type: 'dataZoom',
          xAxisIndex: 0,
          startValue: previousZoom.startValue,
          endValue: previousZoom.endValue,
        }
      : {
          type: 'dataZoom',
          xAxisIndex: 0,
          start: previousZoom.start,
          end: previousZoom.end,
        }
    chart.dispatchAction(action)
  }
  chart.resize()
}

export function applyThemeToChart(chart) {
  if (!chart) return
  chart.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: themeColors().text },
    xAxis: { axisLabel: { color: themeColors().tick }, axisLine: { lineStyle: { color: themeColors().grid } }, splitLine: { lineStyle: { color: themeColors().grid } } },
    yAxis: { axisLabel: { color: themeColors().tick }, splitLine: { lineStyle: { color: themeColors().grid } }, nameTextStyle: { color: themeColors().title } },
  })
  chart.resize()
}

export function applyDateRange(chart, polls, round, institutes, rangeDays, projection) {
  if (!chart) return
  const bounds = rangeBounds(polls, round, institutes, rangeDays, projection)
  chart.setOption({ xAxis: { min: bounds.min ?? undefined, max: bounds.max ?? undefined } })
}

export function resetZoom(chart) {
  if (!chart) return
  chart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
}

export function resetYScale(chart, round) {
  if (!chart) return
  const option = chart.getOption()
  chart.setOption({ yAxis: yScaleForRound(round, option.series || []) })
}
