import './style.css'
import { CANDIDATES } from './candidates.js'
import { loadPollData, loadMeta } from './data/api.ts'
import { mergePolls, normalizePolls } from './data/normalize.ts'
import { createPollChart, updatePollChart, resetZoom, resetYScale, applyThemeToChart } from './chart.js'
import { weightedTrend, averageTrend, trendAt, fmtPct, fmtDelta, fmtDateBR, formatUpdatedStamp } from './aggregate.js'
import { PROJECTION_COPY_PT } from './projection.js'
import { methodologyHTML } from './methodology.js'
import { warmWasmEstimator } from './stats/wasm-estimator.js'
import { exposeE2E } from './e2e-hooks.js'

const DATA_URL = `${import.meta.env.BASE_URL}data/polls.json`
const EXTRA_URL = `${import.meta.env.BASE_URL}data/polls-extra.json`
const META_URL = `${import.meta.env.BASE_URL}data/meta.json`
const THEME_KEY = 'pebr-theme'
const WINDOW_PRESETS = [
  { id: '1', days: 1, label: '1d' },
  { id: '3', days: 3, label: '3d' },
  { id: '7', days: 7, label: '7d' },
  { id: '14', days: 14, label: '14d' },
  { id: '21', days: 21, label: '21d' },
  { id: '30', days: 30, label: 'mês' },
  { id: '90', days: 90, label: '90d' },
  { id: 'ytd', days: null, label: 'YTD' },
]
function daysSinceJan1() {
  const now = new Date()
  return Math.max(1, Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 86400000))
}
function resolveWindowDays(presetId, customDays) {
  if (presetId === 'custom') return Math.max(1, Number(customDays) || 1)
  if (presetId === 'ytd') return daysSinceJan1()
  return WINDOW_PRESETS.find((x) => x.id === presetId)?.days ?? 1
}
const DEFAULT_CHECK_INTERVAL_MINUTES = 60
const state = {
  raw: [], polls: [], meta: null, updatedLabel: null, lastCheckAt: null,
  checkIntervalMs: DEFAULT_CHECK_INTERVAL_MINUTES * 60 * 1000,
  checkTimerId: null, metaPollId: null, awaitingCheck: false,
  round: 1, institutes: new Set(), allInstitutes: [],
  windowPreset: '14', windowCustom: 14, windowDays: 14,
  rangeDays: 30, projection: false, chart: null,
}
function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light')
  localStorage.setItem(THEME_KEY, t)
  const btn = document.getElementById('themeToggle')
  if (btn) btn.textContent = t === 'dark' ? 'Claro' : 'Escuro'
  applyThemeToChart(state.chart)
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return 'dark'
}
async function boot() {
  applyTheme(initTheme())
  applyUrlViewState()
  document.getElementById('app').innerHTML = shellHTML()
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  fillProjectionCopy(); syncProjectionUI(); bindChrome(); syncPrimaryControls()
  try {
    const bundle = await loadPollData(DATA_URL, EXTRA_URL, META_URL)
    state.raw = mergePolls(bundle.polls, bundle.extra)
    state.polls = normalizePolls(state.raw)
    state.meta = bundle.meta
    state.updatedLabel = resolveUpdatedStamp(bundle.meta, state.polls)
    state.allInstitutes = [...new Set(state.polls.map((p) => p.institute))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    state.institutes = new Set(state.allInstitutes)
    applyUrlViewState(state.allInstitutes)
    publishDataStore()
    renderInstituteChips(); renderLegend(); renderCards(); renderTable(); syncWindowUI(); syncPrimaryControls()
    state.chart = createPollChart(document.getElementById('pollChart'), chartOpts())
    setStamp(); applyCheckMeta(bundle.meta); startCheckTimers()
    void initializeWasmSmoke()
  } catch (err) {
    document.getElementById('chartError').textContent = `Não foi possível carregar as pesquisas: ${err.message}`
  }
}
async function initializeWasmSmoke() {
  try {
    const wasm = await warmWasmEstimator()
    if (!window.__pebr) return
    window.__pebr.wasm = wasm
    document.dispatchEvent(new CustomEvent('pebr-wasm-ready', { detail: wasm }))
  } catch (err) {
    if (!window.__pebr) return
    window.__pebr.wasm = { available: false, source: 'js-fallback', parityDifference: null, parityOk: null, runtimeVerified: false }
    document.dispatchEvent(new CustomEvent('pebr-wasm-ready', { detail: window.__pebr.wasm }))
    console.warn('WASM estimator smoke check failed; using JS fallback.', err)
  }
}

function chartOpts() {
  return { polls: state.polls, round: state.round, institutes: state.institutes, windowDays: state.windowDays, rangeDays: state.rangeDays, projection: state.projection }
}
function publishDataStore() {
  const store = {
    version: 1,
    raw: state.raw,
    polls: state.polls,
    meta: state.meta,
    updatedLabel: state.updatedLabel,
    urls: { data: DATA_URL, extra: EXTRA_URL, meta: META_URL },
    view: {
      round: state.round,
      rangeDays: state.rangeDays,
      windowDays: state.windowDays,
      windowPreset: state.windowPreset,
      institutes: [...state.institutes],
      model: Number(window.__pebrProjModel ?? 1),
    },
  }
  window.__pebr = store
  document.dispatchEvent(new CustomEvent('pebr-data-ready', { detail: store }))
}
function applyUrlViewState(allInstitutes = []) {
  const params = new URLSearchParams(location.search)
  const round = Number(params.get('round'))
  if (round === 1 || round === 2) state.round = round
  const range = params.get('range')
  if (range === 'all') state.rangeDays = null
  else if (/^\d+$/.test(range || '')) state.rangeDays = Math.max(1, Number(range))
  const windowValue = params.get('window')
  if (windowValue === 'ytd') {
    state.windowPreset = 'ytd'
    state.windowDays = daysSinceJan1()
  } else if (WINDOW_PRESETS.some((x) => x.id === windowValue && x.id !== 'ytd')) {
    state.windowPreset = windowValue
    state.windowDays = resolveWindowDays(windowValue, state.windowCustom)
  } else if (/^\d+$/.test(windowValue || '')) {
    state.windowPreset = 'custom'
    state.windowCustom = Math.max(1, Number(windowValue))
    state.windowDays = state.windowCustom
  }
  const model = Number(params.get('model'))
  if (Number.isInteger(model) && model >= 0 && model <= 12) {
    window.__pebrProjModel = model
    try { localStorage.setItem('pebr-model', String(model)) } catch {}
  }
  if (allInstitutes.length) {
    const selected = (params.get('institutes') || '')
      .split(',')
      .map((v) => decodeURIComponent(v).trim())
      .filter(Boolean)
      .filter((v) => allInstitutes.includes(v))
    if (selected.length) state.institutes = new Set(selected)
  }
}
function resolveUpdatedStamp(meta, polls) {
  const fromMeta = formatUpdatedStamp(meta?.last_updated)
  if (fromMeta) return fromMeta
  let maxPub = null
  for (const p of polls) { const d = p.published || p.fieldworkEnd; if (d && (!maxPub || d > maxPub)) maxPub = d }
  if (maxPub) return formatUpdatedStamp(/^\d{4}-\d{2}-\d{2}$/.test(maxPub) ? maxPub + 'T12:00:00Z' : maxPub)
  return null
}
function setStamp() {
  const latestPublication = state.meta?.latest_publication_date ? fmtDateBR(state.meta.latest_publication_date) : '—'
  const pipeline = state.meta?.last_successful_pipeline_at ? formatUpdatedStamp(state.meta.last_successful_pipeline_at) : '—'
  document.getElementById('stamp').textContent = `Dados atualizados em ${state.updatedLabel || '—'} · última publicação ${latestPublication} · pipeline auditado ${pipeline} · ${countLabel()}`
}
function applyCheckMeta(meta) {
  state.meta = meta
  const iso = meta?.last_check_at || meta?.last_updated || null
  const d = iso ? new Date(iso) : null
  if (d && !Number.isNaN(d.getTime())) {
    const prevMs = state.lastCheckAt?.getTime()
    if (prevMs == null || d.getTime() >= prevMs || !state.awaitingCheck) { state.lastCheckAt = d; state.awaitingCheck = false }
  } else if (!state.lastCheckAt) state.lastCheckAt = new Date()
  const mins = Number(meta?.check_interval_minutes)
  state.checkIntervalMs = Number.isFinite(mins) && mins > 0 ? mins * 60 * 1000 : DEFAULT_CHECK_INTERVAL_MINUTES * 60 * 1000
}
function formatElapsedPt(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return 'há menos de 1 min'
  const min = Math.floor(sec / 60)
  if (min < 60) return min === 1 ? 'há 1 min' : `há ${min} min`
  const h = Math.floor(min / 60), rem = min % 60
  if (h < 48) return rem === 0 ? (h === 1 ? 'há 1 h' : `há ${h} h`) : `há ${h === 1 ? '1 h' : h + ' h'} e ${rem === 1 ? '1 min' : rem + ' min'}`
  const days = Math.floor(h / 24)
  return days === 1 ? 'há 1 dia' : `há ${days} dias`
}
function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
function tickCheckTimer() {
  const lastEl = document.getElementById('lastCheckLine')
  const nextEl = document.getElementById('nextCheckLine')
  if (!lastEl || !nextEl || !state.lastCheckAt) return
  const elapsed = Math.max(0, Date.now() - state.lastCheckAt.getTime())
  const remaining = state.checkIntervalMs - elapsed
  lastEl.textContent = `Última verificação: ${formatElapsedPt(elapsed)}`
  nextEl.textContent = remaining <= 0 ? 'Verificação em andamento…' : `Próxima verificação em: ${formatCountdown(remaining)}`
}
async function refreshDataQuietly() {
  const bust = `?v=${Date.now()}`
  try {
    const [pollRes, extraRes, meta] = await Promise.all([
      fetch(DATA_URL + bust, { cache: 'no-store' }),
      fetch(EXTRA_URL + bust, { cache: 'no-store' }),
      loadMeta(true),
    ])
    if (!pollRes.ok) throw new Error(`HTTP ${pollRes.status}`)
    const data = await pollRes.json()
    const base = Array.isArray(data) ? data : data.polls || []
    let extra = []
    if (extraRes.ok) {
      try {
        const ex = await extraRes.json()
        extra = Array.isArray(ex) ? ex : ex.polls || []
      } catch {}
    }
    const nextRaw = mergePolls(base, extra)
    const nextPolls = normalizePolls(nextRaw)
    const nextHash = JSON.stringify(nextRaw)
    const prevHash = JSON.stringify(state.raw)
    if (nextHash !== prevHash) {
      const hadAllInstitutesSelected = state.allInstitutes.length > 0
        && state.institutes.size === state.allInstitutes.length
      const previouslySelected = new Set(state.institutes)
      state.raw = nextRaw
      state.polls = nextPolls
      state.allInstitutes = [...new Set(state.polls.map((p) => p.institute))].sort((a, b) => a.localeCompare('pt-BR'))
      state.institutes = hadAllInstitutesSelected
        ? new Set(state.allInstitutes)
        : new Set([...previouslySelected].filter((name) => state.allInstitutes.includes(name)))
      if (!state.institutes.size && state.allInstitutes.length) state.institutes = new Set(state.allInstitutes)
      publishDataStore()
      renderInstituteChips(); renderLegend(); renderCards(); renderTable(); syncWindowUI(); syncPrimaryControls()
      if (state.chart) updatePollChart(state.chart, chartOpts())
      else state.chart = createPollChart(document.getElementById('pollChart'), chartOpts())
      document.getElementById('chartError').textContent = ''
    }
    if (meta) {
      state.meta = meta
      state.updatedLabel = resolveUpdatedStamp(meta, state.polls)
      applyCheckMeta(meta)
      setStamp()
      publishDataStore()
    }
    tickCheckTimer()
  } catch (err) {
    const errorEl = document.getElementById('chartError')
    if (errorEl) errorEl.textContent = `Atualização automática falhou: ${err.message}`
  }
}
async function refreshMetaQuietly() {
  await refreshDataQuietly()
}

exposeE2E('refreshDataQuietly', refreshDataQuietly)
exposeE2E('getState', () => state)
function startCheckTimers() {
  if (state.checkTimerId) clearInterval(state.checkTimerId)
  if (state.metaPollId) clearInterval(state.metaPollId)
  tickCheckTimer()
  state.checkTimerId = setInterval(tickCheckTimer, 1000)
  state.metaPollId = setInterval(refreshDataQuietly, 60_000)
}
function shellHTML() {
  const presetBtns = WINDOW_PRESETS.map((p) => `<button type="button" class="chip${p.id === '14' ? ' on' : ''}" data-win="${p.id}">${p.label}</button>`).join('')
  return `<header class="app-hdr"><div class="wrap"><div class="hdr-row"><div class="hdr-text">
    <h1>Pesquisas eleitorais — Presidência 2026</h1>
    <p>Agregador neutro com pesquisas nacionais publicadas. Pontos = pesquisas individuais; linhas = média ponderada.</p>
    <div class="stamp" id="stamp">Carregando…</div>
    <div class="check-timer" id="checkTimer" aria-live="polite"><div id="lastCheckLine">Última verificação: —</div><div id="nextCheckLine">Próxima verificação em: —</div></div>
    <p class="refresh-notice">Novas pesquisas publicadas podem levar até cerca de 1 hora para aparecer (busca automática periódica).</p>
    </div><button type="button" class="theme-toggle" id="themeToggle" aria-label="Alternar tema">Escuro</button></div></div></header>
    <main class="wrap main-stack"><section class="panel chart-panel" id="chartPanel">
    <h2 class="chart-title">Evolução da intenção de voto</h2>
    <div class="controls controls-primary">
      <div class="seg" role="group" aria-label="Turno"><button type="button" data-round="1" class="active">1º turno</button><button type="button" data-round="2"><span class="lbl-full">2º turno (Lula × Flávio)</span><span class="lbl-short">2º turno</span></button></div>
      <div class="seg range-seg" role="group" aria-label="Período"><button type="button" data-range="1">1d</button><button type="button" data-range="3">3d</button><button type="button" data-range="7">7d</button><button type="button" data-range="14">14d</button><button type="button" data-range="21">21d</button><button type="button" data-range="30" class="active">30d</button><button type="button" data-range="90">90d</button><button type="button" data-range="all">tudo</button></div>
    </div>
    <div class="chart-box"><canvas id="pollChart" aria-label="Gráfico de pesquisas"></canvas></div>
    <div class="chart-below"><div class="controls controls-secondary">
      <div class="window-row"><span class="ctrl">Janela da média</span><div class="window-presets" role="group">${presetBtns}</div>
      <label class="ctrl">personalizado <input type="number" class="win-custom" id="windowCustom" min="1" step="1" value="1" inputmode="numeric" /> <strong id="windowVal">1d</strong></label></div>
      <label class="toggle-proj"><input type="checkbox" id="projectionToggle" /><span id="projToggleText"></span><span class="chip proj-chip" id="projChip" hidden></span></label>
      <div class="axis-btns"><button type="button" class="chip btn-reset" id="resetZoom">Resetar eixos</button><button type="button" class="chip btn-axis" id="resetY">Resetar Y</button></div>
    </div>
    <p class="proj-disclaimer" id="projDisclaimer"></p>
    <div class="filters institutes-inline" id="institutes"></div><div class="legend" id="legend"></div>
    <p class="hint">Zoom X/Y: roda do mouse, pinça ou Shift+arrastar. Fontes: TSE e institutos.</p>
    <p class="hint" id="chartError" style="color:#c62828"></p></div></section>
    <section class="cards" id="cards" aria-live="polite"></section>
    <section class="panel"><h2>Tabela de pesquisas</h2><div class="table-wrap"><table class="polls"><thead id="thead"></thead><tbody id="tbody"></tbody></table></div></section>
    ${methodologyHTML()}
    <footer><p>Site estático e sem fins partidários. Hospedagem via GitHub Pages.</p></footer></main>`
}
function fillProjectionCopy() {
  const copy = PROJECTION_COPY_PT
  const textEl = document.getElementById('projToggleText')
  const input = document.getElementById('projectionToggle')
  const chip = document.getElementById('projChip')
  const disc = document.getElementById('projDisclaimer')
  const meto = document.getElementById('projMethodology')
  if (textEl) textEl.textContent = copy.toggleLabel
  if (input) input.setAttribute('aria-label', copy.toggleAria)
  if (chip) chip.textContent = copy.chipOn
  if (disc) disc.textContent = copy.chartHint
  if (meto) meto.textContent = copy.methodology
}
function syncProjectionUI() {
  document.getElementById('projDisclaimer')?.classList.toggle('on', !!state.projection)
  const chip = document.getElementById('projChip')
  if (chip) chip.hidden = !state.projection
}
function syncPrimaryControls() {
  document.querySelectorAll('[data-round]').forEach((b) => b.classList.toggle('active', Number(b.dataset.round) === state.round))
  document.querySelectorAll('[data-range]').forEach((b) => {
    const id = b.dataset.range
    const active = id === 'all' ? state.rangeDays == null : Number(id) === state.rangeDays
    b.classList.toggle('active', active)
  })
}
function syncWindowUI() {
  const val = document.getElementById('windowVal')
  const custom = document.getElementById('windowCustom')
  if (val) val.textContent = state.windowPreset === 'ytd' ? `${state.windowDays}d (YTD)` : `${state.windowDays}d`
  if (custom && state.windowPreset === 'custom') custom.value = String(state.windowDays)
  document.querySelectorAll('[data-win]').forEach((b) => b.classList.toggle('on', state.windowPreset !== 'custom' && b.dataset.win === state.windowPreset))
}
function setWindowPreset(id) { state.windowPreset = id; state.windowDays = resolveWindowDays(id, state.windowCustom); syncWindowUI(); refresh() }
function setWindowCustom(n) {
  const days = Math.max(1, Math.floor(Number(n) || 1))
  state.windowPreset = 'custom'; state.windowCustom = days; state.windowDays = days; syncWindowUI(); refresh()
}
function bindChrome() {
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    applyTheme(cur === 'dark' ? 'light' : 'dark')
  })
  document.querySelectorAll('[data-round]').forEach((btn) => btn.addEventListener('click', () => {
    state.round = Number(btn.dataset.round)
    document.querySelectorAll('[data-round]').forEach((b) => b.classList.toggle('active', b === btn))
    refresh()
  }))
  document.querySelectorAll('[data-range]').forEach((btn) => btn.addEventListener('click', () => {
    state.rangeDays = btn.dataset.range === 'all' ? null : Number(btn.dataset.range)
    document.querySelectorAll('[data-range]').forEach((b) => b.classList.toggle('active', b === btn))
    refresh()
  }))
  document.querySelectorAll('[data-win]').forEach((btn) => btn.addEventListener('click', () => setWindowPreset(btn.dataset.win)))
  const custom = document.getElementById('windowCustom')
  custom?.addEventListener('change', () => setWindowCustom(custom.value))
  custom?.addEventListener('input', () => {
    const n = Math.max(1, Math.floor(Number(custom.value) || 1))
    if (String(custom.value) === '' || Number(custom.value) < 1) return
    state.windowPreset = 'custom'; state.windowCustom = n; state.windowDays = n; syncWindowUI(); refresh()
  })
  document.getElementById('projectionToggle')?.addEventListener('change', (e) => { state.projection = !!e.target.checked; syncProjectionUI(); refresh() })
  document.getElementById('resetZoom')?.addEventListener('click', () => {
    if (!state.chart) return
    resetZoom(state.chart); resetYScale(state.chart, state.round); updatePollChart(state.chart, chartOpts())
  })
  document.getElementById('resetY')?.addEventListener('click', () => {
    if (!state.chart) return
    resetYScale(state.chart, state.round)
    updatePollChart(state.chart, chartOpts())
  })
}
function renderInstituteChips() {
  const el = document.getElementById('institutes')
  el.innerHTML = ''
  const all = document.createElement('button')
  all.type = 'button'; all.className = 'chip all on'; all.textContent = 'Todos'
  all.addEventListener('click', () => { state.institutes = new Set(state.allInstitutes); Array.from(el.querySelectorAll('.chip')).forEach((c) => c.classList.add('on')); refresh() })
  el.appendChild(all)
  for (const name of state.allInstitutes) {
    const b = document.createElement('button')
    b.type = 'button'; b.className = 'chip on'; b.textContent = name
    b.addEventListener('click', () => {
      if (state.institutes.has(name) && state.institutes.size === 1) return
      if (state.institutes.has(name)) state.institutes.delete(name); else state.institutes.add(name)
      b.classList.toggle('on', state.institutes.has(name))
      all.classList.toggle('on', state.institutes.size === state.allInstitutes.length)
      refresh()
    })
    el.appendChild(b)
  }
}
function renderLegend() {
  const el = document.getElementById('legend')
  const list = state.round === 2 ? CANDIDATES.filter((c) => c.key === 'lula' || c.key === 'flavio' || c.key === 'branco_nulo') : CANDIDATES
  el.innerHTML = list.map((c) => `<span><i class="swatch" style="background:${c.color}"></i>${c.label}</span>`).join('')
}
function activePolls() { return state.polls.filter((p) => p.round === state.round && state.institutes.has(p.institute)) }
function renderCards() {
  const el = document.getElementById('cards')
  const polls = activePolls()
  const keys = state.round === 2 ? ['lula', 'flavio'] : CANDIDATES.map((c) => c.key)
  const now = polls.length ? polls[polls.length - 1].t : Date.now()
  const ago = now - 30 * 86400000
  el.innerHTML = keys.map((key) => {
    const c = CANDIDATES.find((x) => x.key === key)
    const pts = polls.filter((p) => p.results[key] != null).map((p) => ({ t: p.t, y: p.results[key], n: p.n, institute: p.institute, moe: p.moe }))
    const avgModel = Number(window.__pebrProjModel == null ? 1 : window.__pebrProjModel)
    const trend = averageTrend(pts, state.windowDays, avgModel)
    const cur = trendAt(trend, now), then = trendAt(trend, ago)
    const d = fmtDelta(cur != null && then != null ? cur - then : null)
    return `<article class="card" data-c="${key}"><div class="name">${c.label}</div><div class="val">${fmtPct(cur)}</div><div class="delta ${d.cls}">${d.text}</div></article>`
  }).join('')
}
function renderTable() {
  const keys = state.round === 2 ? ['lula', 'flavio'] : CANDIDATES.map((c) => c.key)
  document.getElementById('thead').innerHTML = `<tr><th>Campo</th><th>Publicação</th><th>Instituto</th><th>Geo</th><th>TSE</th><th>N</th><th>Margem</th>${keys.map((k) => `<th>${CANDIDATES.find((c) => c.key === k).label}</th>`).join('')}<th>Fonte</th></tr>`
  document.getElementById('tbody').innerHTML = [...activePolls()].reverse().map((p) => {
    const cells = keys.map((k) => `<td class="num">${p.results[k] == null ? '—' : p.results[k].toLocaleString('pt-BR')}</td>`).join('')
    const link = p.sourceUrl ? `<a href="${escapeHtml(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">ver</a>` : '—'
    const published = fmtDateBR(p.published)
    const geo = escapeHtml(p.geo || 'BR')
    const tse = escapeHtml(p.tse || '—')
    const moe = escapeHtml(p.moeRaw || (p.moe != null ? '±' + p.moe : '—'))
    return `<tr><td>${fmtDateBR(p.fieldworkStart)}–${fmtDateBR(p.fieldworkEnd)}</td><td>${published}</td><td>${escapeHtml(p.institute)}</td><td>${geo}</td><td>${tse}</td><td class="num">${p.n?.toLocaleString('pt-BR') ?? '—'}</td><td class="num">${moe}</td>${cells}<td>${link}</td></tr>`
  }).join('')
}
function refresh() {
  renderLegend(); renderCards(); renderTable()
  publishDataStore()
  if (state.chart) updatePollChart(state.chart, chartOpts())
  setStamp()
}
function countLabel() {
  return `${state.polls.filter((p) => p.round === 1).length} pesquisas de 1º turno · ${state.polls.filter((p) => p.round === 2).length} de 2º turno`
}
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
boot()
