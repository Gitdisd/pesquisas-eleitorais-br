import './style.css'
import 'hammerjs'
import { CANDIDATES, matchCandidate, parseMoe, isFirstRound, isSecondRound } from './candidates.js'
import { createPollChart, updatePollChart, resetZoom, resetYScale, applyThemeToChart } from './chart.js'
import { weightedTrend, trendAt, fmtPct, fmtDelta, fmtDateBR, formatUpdatedStamp } from './aggregate.js'
import { PROJECTION_COPY_PT } from './projection.js'

const DATA_URL = `${import.meta.env.BASE_URL}data/polls.json`
const EXTRA_URL = `${import.meta.env.BASE_URL}data/polls-extra.json`
const META_URL = `${import.meta.env.BASE_URL}data/meta.json`
const THEME_KEY = 'pebr-theme'
const WINDOW_PRESETS = [
  { id: '1', days: 1, label: '1d' },
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
const DEFAULT_CHECK_INTERVAL_MINUTES = 190
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
function pollKey(p) {
  return [p.institute, p.fieldwork_end, p.scenario].join('|')
}
function mergePolls(base, extra) {
  const map = new Map()
  for (const p of base || []) map.set(pollKey(p), p)
  for (const p of extra || []) {
    if (p && p.institute && p.fieldwork_end && p.scenario) map.set(pollKey(p), p)
  }
  return [...map.values()]
}
async function boot() {
  applyTheme(initTheme())
  document.getElementById('app').innerHTML = shellHTML()
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  fillProjectionCopy(); syncProjectionUI(); bindChrome()
  try {
    const [pollRes, extraRes, meta] = await Promise.all([fetch(DATA_URL), fetch(EXTRA_URL), loadMeta()])
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
    state.raw = mergePolls(base, extra)
    state.polls = normalize(state.raw)
    state.meta = meta
    state.updatedLabel = resolveUpdatedStamp(meta, state.polls)
    state.allInstitutes = [...new Set(state.polls.map((p) => p.institute))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    state.institutes = new Set(state.allInstitutes)
    renderInstituteChips(); renderLegend(); renderCards(); renderTable(); syncWindowUI()
    state.chart = createPollChart(document.getElementById('pollChart'), chartOpts())
    setStamp(); applyCheckMeta(meta); startCheckTimers()
  } catch (err) {
    document.getElementById('chartError').textContent = `Não foi possível carregar as pesquisas: ${err.message}`
  }
}
function chartOpts() {
  return { polls: state.polls, round: state.round, institutes: state.institutes, windowDays: state.windowDays, rangeDays: state.rangeDays, projection: state.projection }
}
async function loadMeta() {
  try { const res = await fetch(META_URL); return res.ok ? await res.json() : null } catch { return null }
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
  document.getElementById('stamp').textContent = `Atualizado em ${state.updatedLabel || '—'} · ${countLabel()}`
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
  const elapsed = Date.now() - state.lastCheckAt.getTime()
  const remaining = state.checkIntervalMs - elapsed
  if (remaining <= 0) {
    state.awaitingCheck = true
    state.lastCheckAt = new Date()
    lastEl.textContent = `Última verificação: ${formatElapsedPt(0)}`
    nextEl.textContent = 'Verificando em breve…'
    return
  }
  lastEl.textContent = `Última verificação: ${formatElapsedPt(elapsed)}`
  nextEl.textContent = `Próxima verificação em: ${formatCountdown(remaining)}`
}
async function refreshMetaQuietly() {
  const meta = await loadMeta()
  if (!meta) return
  const prevIso = state.meta?.last_check_at || state.meta?.last_updated
  const nextIso = meta.last_check_at || meta.last_updated
  applyCheckMeta(meta)
  const stampLabel = resolveUpdatedStamp(meta, state.polls)
  if (stampLabel) { state.updatedLabel = stampLabel; setStamp() }
  if (nextIso && nextIso !== prevIso) tickCheckTimer()
}
function startCheckTimers() {
  if (state.checkTimerId) clearInterval(state.checkTimerId)
  if (state.metaPollId) clearInterval(state.metaPollId)
  tickCheckTimer()
  state.checkTimerId = setInterval(tickCheckTimer, 1000)
  state.metaPollId = setInterval(refreshMetaQuietly, 60_000)
}
function normalize(rows) {
  return rows.map((row, idx) => {
    const scenario = row.scenario || ''
    let round = null
    if (isSecondRound(scenario) && /lula/i.test(scenario) && /fl[aá]vio/i.test(scenario)) round = 2
    else if (isFirstRound(scenario) && !isSecondRound(scenario)) round = 1
    else if (isSecondRound(scenario)) round = 2
    else if (isFirstRound(scenario)) round = 1
    if (!round) return null
    const results = {}
    for (const c of row.candidates || []) {
      const m = matchCandidate(c.name)
      if (m && typeof c.pct === 'number') results[m.key] = c.pct
    }
    if (round === 2 && (results.lula == null || results.flavio == null)) return null
    if (round === 1 && results.lula == null && results.flavio == null) return null
    const end = row.fieldwork_end || row.published_date
    if (!end) return null
    return {
      id: `${row.institute}-${end}-${round}-${idx}`, institute: row.institute, published: row.published_date,
      fieldworkStart: row.fieldwork_start, fieldworkEnd: end, t: Date.parse(end + 'T12:00:00Z'),
      n: row.n, moe: parseMoe(row.margin_of_error), moeRaw: row.margin_of_error, method: row.methodology_note,
      tse: (row.methodology_note || '').match(/BR-\d+\/\d+/)?.[0] || null, scenario, round, results,
      sourceUrl: row.source_url, verified: row.verified !== false, flag: row.flag,
    }
  }).filter(Boolean).sort((a, b) => a.t - b.t)
}
function shellHTML() {
  const presetBtns = WINDOW_PRESETS.map((p) => `<button type="button" class="chip${p.id === '14' ? ' on' : ''}" data-win="${p.id}">${p.label}</button>`).join('')
  return `<header class="app-hdr"><div class="wrap"><div class="hdr-row"><div class="hdr-text">
    <h1>Pesquisas eleitorais — Presidência 2026</h1>
    <p>Agregador neutro com pesquisas nacionais publicadas. Pontos = pesquisas individuais; linhas = média ponderada.</p>
    <div class="stamp" id="stamp">Carregando…</div>
    <div class="check-timer" id="checkTimer" aria-live="polite"><div id="lastCheckLine">Última verificação: —</div><div id="nextCheckLine">Próxima verificação em: —</div></div>
    <p class="refresh-notice">Novas pesquisas publicadas podem levar até cerca de 3 horas para aparecer (busca automática periódica).</p>
    </div><button type="button" class="theme-toggle" id="themeToggle" aria-label="Alternar tema">Escuro</button></div></div></header>
    <main class="wrap main-stack"><section class="panel chart-panel" id="chartPanel">
    <h2 class="chart-title">Evolução da intenção de voto</h2>
    <div class="controls controls-primary">
      <div class="seg" role="group" aria-label="Turno"><button type="button" data-round="1" class="active">1º turno</button><button type="button" data-round="2"><span class="lbl-full">2º turno (Lula × Flávio)</span><span class="lbl-short">2º turno</span></button></div>
      <div class="seg range-seg" role="group" aria-label="Período"><button type="button" data-range="30" class="active">30d</button><button type="button" data-range="90">90d</button><button type="button" data-range="all">tudo</button></div>
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
    <section class="panel metodologia"><h2>Metodologia</h2>
    <p>Pontos no gráfico são pesquisas individuais. A linha é uma <strong>média ponderada</strong>: peso ≈ √(N/2000) × exp(−dias/janela). Variação nos cartões vs <strong>meados de maio/2026</strong>.</p>
    <p>Os dados são atualizados por busca automática periódica (até cerca de 3 horas).</p>
    <p id="projMethodology"></p></section>
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
    try { state.chart.resetZoom('y') } catch {}
    state.chart.update('none')
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
    const pts = polls.filter((p) => p.results[key] != null).map((p) => ({ t: p.t, y: p.results[key], n: p.n, institute: p.institute }))
    const trend = weightedTrend(pts, state.windowDays)
    const cur = trendAt(trend, now), then = trendAt(trend, ago)
    const d = fmtDelta(cur != null && then != null ? cur - then : null)
    return `<article class="card" data-c="${key}"><div class="name">${c.label}</div><div class="val">${fmtPct(cur)}</div><div class="delta ${d.cls}">${d.text}</div></article>`
  }).join('')
}
function renderTable() {
  const keys = state.round === 2 ? ['lula', 'flavio'] : CANDIDATES.map((c) => c.key)
  document.getElementById('thead').innerHTML = `<tr><th>Campo</th><th>Instituto</th><th>N</th><th>Margem</th>${keys.map((k) => `<th>${CANDIDATES.find((c) => c.key === k).label}</th>`).join('')}<th>Fonte</th></tr>`
  document.getElementById('tbody').innerHTML = [...activePolls()].reverse().map((p) => {
    const cells = keys.map((k) => `<td class="num">${p.results[k] == null ? '—' : p.results[k].toLocaleString('pt-BR')}</td>`).join('')
    const link = p.sourceUrl ? `<a href="${p.sourceUrl}" target="_blank" rel="noopener noreferrer">ver</a>` : '—'
    return `<tr><td>${fmtDateBR(p.fieldworkStart)}–${fmtDateBR(p.fieldworkEnd)}</td><td>${escapeHtml(p.institute)}</td><td class="num">${p.n?.toLocaleString('pt-BR') ?? '—'}</td><td class="num">${p.moeRaw || (p.moe != null ? '±' + p.moe : '—')}</td>${cells}<td>${link}</td></tr>`
  }).join('')
}
function refresh() {
  renderLegend(); renderCards(); renderTable()
  if (state.chart) updatePollChart(state.chart, chartOpts())
  setStamp()
}
function countLabel() {
  return `${state.polls.filter((p) => p.round === 1).length} pesquisas de 1º turno · ${state.polls.filter((p) => p.round === 2).length} de 2º turno`
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"')
}
boot()
