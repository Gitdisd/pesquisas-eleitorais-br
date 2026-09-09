import './style.css'
import 'hammerjs'
import { CANDIDATES, matchCandidate, parseMoe, isFirstRound, isSecondRound } from './candidates.js'
import { createPollChart, updatePollChart, resetZoom, resetYScale, applyThemeToChart } from './chart.js'
import { weightedTrend, trendAt, fmtPct, fmtDelta, fmtDateBR, formatUpdatedStamp } from './aggregate.js'
import { PROJECTION_COPY_PT } from './projection.js'

const DATA_URL = `${import.meta.env.BASE_URL}data/polls.json`
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
  const jan1 = new Date(now.getFullYear(), 0, 1)
  return Math.max(1, Math.ceil((now - jan1) / 86400000))
}

function resolveWindowDays(presetId, customDays) {
  if (presetId === 'custom') return Math.max(1, Number(customDays) || 1)
  if (presetId === 'ytd') return daysSinceJan1()
  const p = WINDOW_PRESETS.find((x) => x.id === presetId)
  return p?.days ?? 14
}

const DEFAULT_CHECK_INTERVAL_MINUTES = 190

const state = {
  raw: [],
  polls: [],
  meta: null,
  updatedLabel: null,
  lastCheckAt: null,
  checkIntervalMs: DEFAULT_CHECK_INTERVAL_MINUTES * 60 * 1000,
  checkTimerId: null,
  metaPollId: null,
  awaitingCheck: false,
  round: 1,
  institutes: new Set(),
  allInstitutes: [],
  windowPreset: '14',
  windowCustom: 14,
  windowDays: 14,
  rangeDays: null,
  projection: false,
  chart: null,
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
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

async function boot() {
  applyTheme(initTheme())
  const app = document.getElementById('app')
  app.innerHTML = shellHTML()
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  fillProjectionCopy()
  syncProjectionUI()
  bindChrome()
  try {
    const [pollRes, meta] = await Promise.all([fetch(DATA_URL), loadMeta()])
    if (!pollRes.ok) throw new Error(`HTTP ${pollRes.status}`)
    const data = await pollRes.json()
    state.raw = Array.isArray(data) ? data : data.polls || []
    state.polls = normalize(state.raw)
    state.meta = meta
    state.updatedLabel = resolveUpdatedStamp(meta, state.polls)
    state.allInstitutes = [...new Set(state.polls.map((p) => p.institute))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    )
    state.institutes = new Set(state.allInstitutes)
    renderInstituteChips()
    renderLegend()
    renderCards()
    renderTable()
    syncWindowUI()
    const canvas = document.getElementById('pollChart')
    state.chart = createPollChart(canvas, chartOpts())
    setStamp()
    applyCheckMeta(meta)
    startCheckTimers()
  } catch (err) {
    document.getElementById('chartError').textContent =
      `Não foi possível carregar as pesquisas: ${err.message}`
  }
}

function chartOpts() {
  return {
    polls: state.polls,
    round: state.round,
    institutes: state.institutes,
    windowDays: state.windowDays,
    rangeDays: state.rangeDays,
    projection: state.projection,
  }
}

async function loadMeta() {
  try {
    const res = await fetch(META_URL)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function resolveUpdatedStamp(meta, polls) {
  const fromMeta = formatUpdatedStamp(meta?.last_updated)
  if (fromMeta) return fromMeta
  let maxPub = null
  for (const p of polls) {
    const d = p.published || p.fieldworkEnd
    if (d && (!maxPub || d > maxPub)) maxPub = d
  }
  if (maxPub) {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(maxPub) ? maxPub + 'T12:00:00Z' : maxPub
    return formatUpdatedStamp(iso)
  }
  return null
}

function setStamp() {
  const stamp = document.getElementById('stamp')
  const when = state.updatedLabel || '—'
  stamp.textContent = `Atualizado em ${when} · ${countLabel()}`
}

function applyCheckMeta(meta) {
  state.meta = meta
  const iso = meta?.last_check_at || meta?.last_updated || null
  const d = iso ? new Date(iso) : null
  if (d && !Number.isNaN(d.getTime())) {
    const prevMs = state.lastCheckAt?.getTime()
    const nextMs = d.getTime()
    if (prevMs == null || nextMs >= prevMs || !state.awaitingCheck) {
      state.lastCheckAt = d
      state.awaitingCheck = false
    }
  } else if (!state.lastCheckAt) {
    state.lastCheckAt = new Date()
  }
  const mins = Number(meta?.check_interval_minutes)
  if (Number.isFinite(mins) && mins > 0) {
    state.checkIntervalMs = mins * 60 * 1000
  } else {
    state.checkIntervalMs = DEFAULT_CHECK_INTERVAL_MINUTES * 60 * 1000
  }
}

function formatElapsedPt(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return 'há menos de 1 min'
  const min = Math.floor(sec / 60)
  if (min < 60) return min === 1 ? 'há 1 min' : `há ${min} min`
  const h = Math.floor(min / 60)
  const rem = min % 60
  if (h < 48) {
    if (rem === 0) return h === 1 ? 'há 1 h' : `há ${h} h`
    const hPart = h === 1 ? '1 h' : `${h} h`
    const mPart = rem === 1 ? '1 min' : `${rem} min`
    return `há ${hPart} e ${mPart}`
  }
  const days = Math.floor(h / 24)
  return days === 1 ? 'há 1 dia' : `há ${days} dias`
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function tickCheckTimer() {
  const lastEl = document.getElementById('lastCheckLine')
  const nextEl = document.getElementById('nextCheckLine')
  if (!lastEl || !nextEl || !state.lastCheckAt) return
  const now = Date.now()
  let elapsed = now - state.lastCheckAt.getTime()
  let remaining = state.checkIntervalMs - elapsed
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
  if (stampLabel) {
    state.updatedLabel = stampLabel
    setStamp()
  }
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
  return rows
    .map((row, idx) => {
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
        id: `${row.institute}-${end}-${round}-${idx}`,
        institute: row.institute,
        published: row.published_date,
        fieldworkStart: row.fieldwork_start,
        fieldworkEnd: end,
        t: Date.parse(end + 'T12:00:00Z'),
        n: row.n,
        moe: parseMoe(row.margin_of_error),
        moeRaw: row.margin_of_error,
        method: row.methodology_note,
        tse: (row.methodology_note || '').match(/BR-\d+\/\d+/)?.[0] || null,
        scenario,
        round,
        results,
        sourceUrl: row.source_url,
        verified: row.verified !== false,
        flag: row.flag,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t)
}
