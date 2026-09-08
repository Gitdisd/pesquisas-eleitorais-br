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

const state = {
  raw: [],
  polls: [],
  meta: null,
  updatedLabel: null,
  round: 1,
  institutes: new Set(),
  allInstitutes: [],
  windowPreset: '14',
  windowCustom: 14,
  windowDays: 14,
  rangeDays: null, // null = tudo; 30 | 90
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

/** Prefer data/meta.json last_updated; fallback to max published_date among polls. */
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

function shellHTML() {
  const presetBtns = WINDOW_PRESETS.map(
    (p) =>
      `<button type="button" class="chip${p.id === '14' ? ' on' : ''}" data-win="${p.id}">${p.label}</button>`,
  ).join('')
  return `
  <header class="app-hdr"><div class="wrap">
    <div class="hdr-row">
      <div class="hdr-text">
        <h1>Pesquisas eleitorais — Presidência 2026</h1>
        <p>Agregador neutro com pesquisas nacionais publicadas. Pontos = pesquisas individuais; linhas = média ponderada.</p>
        <div class="stamp" id="stamp">Carregando…</div>
      </div>
      <button type="button" class="theme-toggle" id="themeToggle" aria-label="Alternar tema">Escuro</button>
    </div>
  </div></header>
  <main class="wrap main-stack">
    <section class="panel chart-panel" id="chartPanel">
      <h2 class="chart-title">Evolução da intenção de voto</h2>
      <div class="controls controls-primary">
        <div class="seg" role="group" aria-label="Turno">
          <button type="button" data-round="1" class="active">1º turno</button>
          <button type="button" data-round="2"><span class="lbl-full">2º turno (Lula × Flávio)</span><span class="lbl-short">2º turno</span></button>
        </div>
        <div class="seg range-seg" role="group" aria-label="Período">
          <button type="button" data-range="30">30d</button>
          <button type="button" data-range="90">90d</button>
          <button type="button" data-range="all" class="active">tudo</button>
        </div>
      </div>
      <div class="chart-box"><canvas id="pollChart" aria-label="Gráfico de pesquisas"></canvas></div>
      <div class="chart-below">
        <div class="controls controls-secondary">
          <div class="window-row">
            <span class="ctrl">Janela da média</span>
            <div class="window-presets" role="group" aria-label="Presets da janela">${presetBtns}</div>
            <label class="ctrl">personalizado
              <input type="number" class="win-custom" id="windowCustom" min="1" step="1" value="14" inputmode="numeric" />
              <strong id="windowVal">14d</strong>
            </label>
          </div>
          <label class="toggle-proj" id="projToggleLabel">
            <input type="checkbox" id="projectionToggle" aria-label="" />
            <span id="projToggleText"></span>
            <span class="chip proj-chip" id="projChip" hidden></span>
          </label>
          <div class="axis-btns">
            <button type="button" class="chip btn-reset" id="resetZoom">Resetar eixos</button>
            <button type="button" class="chip btn-axis" id="resetY" title="Resetar escala Y">Resetar Y</button>
          </div>
        </div>
        <p class="proj-disclaimer" id="projDisclaimer"></p>
        <div class="filters institutes-inline" id="institutes" aria-label="Institutos"></div>
        <div class="legend" id="legend"></div>
        <p class="hint">Zoom X/Y: roda do mouse, pinça ou Shift+arrastar · arraste para panear nos dois eixos (eixo Y redimensionável). Fontes: pesquisas registradas no TSE e divulgações oficiais dos institutos.</p>
        <p class="hint" id="chartError" style="color:#c62828"></p>
      </div>
    </section>
    <section class="cards" id="cards" aria-live="polite"></section>
    <section class="panel">
      <h2>Tabela de pesquisas</h2>
      <div class="table-wrap"><table class="polls"><thead id="thead"></thead><tbody id="tbody"></tbody></table></div>
    </section>
    <section class="panel metodologia">
      <h2>Metodologia</h2>
      <p>Pontos no gráfico são pesquisas individuais (campo/publicação). A linha é uma <strong>média ponderada</strong>: peso ≈ √(N/2000) × exp(−dias/janela). Presets de janela: 1d, 7d, 14d, 21d, mês (~30d), 90d e YTD (dias desde 1º de janeiro do ano corrente); também há controle diário personalizado a partir de 1 dia. A variação nos cartões compara a média atual com a de <strong>meados de maio/2026</strong> (âncora fixa).</p>
      <p id="projMethodology"></p>
      <p>Cores: Lula vermelho (#c62828), Flávio verde da bandeira (#009c3b); demais categóricas. Cartões mostram só a média ponderada observada — não o extremo da projeção.</p>
    </section>
    <footer>
      <p>Site estático e sem fins partidários. Números apenas de pesquisas publicadas e verificadas — lacunas possíveis quando um instituto não mede todos os nomes.</p>
      <p>Fontes: registros e divulgações com identificação junto ao TSE e materiais oficiais dos institutos de pesquisa. Hospedagem gratuita via GitHub Pages.</p>
    </footer>
  </main>`
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
  const on = !!state.projection
  document.getElementById('projDisclaimer')?.classList.toggle('on', on)
  const chip = document.getElementById('projChip')
  if (chip) chip.hidden = !on
}

function syncWindowUI() {
  const val = document.getElementById('windowVal')
  const custom = document.getElementById('windowCustom')
  if (val) {
    if (state.windowPreset === 'ytd') val.textContent = `${state.windowDays}d (YTD)`
    else val.textContent = `${state.windowDays}d`
  }
  if (custom && state.windowPreset === 'custom') custom.value = String(state.windowDays)
  document.querySelectorAll('[data-win]').forEach((b) => {
    b.classList.toggle('on', state.windowPreset !== 'custom' && b.dataset.win === state.windowPreset)
  })
}

function setWindowPreset(id) {
  state.windowPreset = id
  state.windowDays = resolveWindowDays(id, state.windowCustom)
  syncWindowUI()
  refresh()
}

function setWindowCustom(n) {
  const days = Math.max(1, Math.floor(Number(n) || 1))
  state.windowPreset = 'custom'
  state.windowCustom = days
  state.windowDays = days
  syncWindowUI()
  refresh()
}

function bindChrome() {
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    applyTheme(cur === 'dark' ? 'light' : 'dark')
  })

  document.querySelectorAll('[data-round]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.round = Number(btn.dataset.round)
      document.querySelectorAll('[data-round]').forEach((b) => b.classList.toggle('active', b === btn))
      refresh()
    })
  })
  document.querySelectorAll('[data-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.range
      state.rangeDays = v === 'all' ? null : Number(v)
      document.querySelectorAll('[data-range]').forEach((b) => b.classList.toggle('active', b === btn))
      refresh()
    })
  })

  document.querySelectorAll('[data-win]').forEach((btn) => {
    btn.addEventListener('click', () => setWindowPreset(btn.dataset.win))
  })
  const custom = document.getElementById('windowCustom')
  custom?.addEventListener('change', () => setWindowCustom(custom.value))
  custom?.addEventListener('input', () => {
    const n = Math.max(1, Math.floor(Number(custom.value) || 1))
    if (String(custom.value) === '' || Number(custom.value) < 1) return
    state.windowPreset = 'custom'
    state.windowCustom = n
    state.windowDays = n
    syncWindowUI()
    refresh()
  })

  document.getElementById('projectionToggle')?.addEventListener('change', (e) => {
    state.projection = !!e.target.checked
    syncProjectionUI()
    refresh()
  })

  document.getElementById('resetZoom')?.addEventListener('click', () => {
    if (state.chart) {
      resetZoom(state.chart)
      resetYScale(state.chart, state.round)
      updatePollChart(state.chart, chartOpts())
    }
  })
  document.getElementById('resetY')?.addEventListener('click', () => {
    if (state.chart) {
      resetYScale(state.chart, state.round)
      // clear zoom plugin Y limits by resetting then re-applying
      try {
        state.chart.resetZoom('y')
      } catch {
        /* older plugin may only support full reset */
      }
      state.chart.update('none')
    }
  })
}

function renderInstituteChips() {
  const el = document.getElementById('institutes')
  el.innerHTML = ''
  const all = document.createElement('button')
  all.type = 'button'
  all.className = 'chip all on'
  all.textContent = 'Todos'
  all.addEventListener('click', () => {
    state.institutes = new Set(state.allInstitutes)
    Array.from(el.querySelectorAll('.chip')).forEach((c) => c.classList.add('on'))
    refresh()
  })
  el.appendChild(all)
  for (const name of state.allInstitutes) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip on'
    b.textContent = name
    b.addEventListener('click', () => {
      if (state.institutes.has(name) && state.institutes.size === 1) return
      if (state.institutes.has(name)) state.institutes.delete(name)
      else state.institutes.add(name)
      b.classList.toggle('on', state.institutes.has(name))
      all.classList.toggle('on', state.institutes.size === state.allInstitutes.length)
      refresh()
    })
    el.appendChild(b)
  }
}

function renderLegend() {
  const el = document.getElementById('legend')
  const list = state.round === 2 ? CANDIDATES.filter((c) => c.key === 'lula' || c.key === 'flavio') : CANDIDATES
  el.innerHTML = list
    .map(
      (c) =>
        `<span><i class="swatch" style="background:${c.color};${c.borderDash.length ? 'height:0;border-top:2px dashed ' + c.color : ''}"></i>${c.label}</span>`,
    )
    .join('')
}

function activePolls() {
  return state.polls.filter((p) => p.round === state.round && state.institutes.has(p.institute))
}

function renderCards() {
  const el = document.getElementById('cards')
  const polls = activePolls()
  const keys = state.round === 2 ? ['lula', 'flavio'] : CANDIDATES.map((c) => c.key)
  const now = polls.length ? polls[polls.length - 1].t : Date.now()
  const may = Date.parse('2026-05-15T12:00:00Z')
  const html = keys
    .map((key) => {
      const c = CANDIDATES.find((x) => x.key === key)
      const pts = polls
        .filter((p) => p.results[key] != null)
        .map((p) => ({ t: p.t, y: p.results[key], n: p.n }))
      const trend = weightedTrend(pts, state.windowDays)
      const cur = trendAt(trend, now)
      const then = trendAt(trend, may)
      const delta = cur != null && then != null ? cur - then : null
      const d = fmtDelta(delta)
      return `<article class="card" data-c="${key}"><div class="name">${c.label}</div><div class="val">${fmtPct(cur)}</div><div class="delta ${d.cls}" title="Variação da média ponderada vs meados de maio/2026">${d.text}</div></article>`
    })
    .join('')
  el.innerHTML = html
}

function renderTable() {
  const thead = document.getElementById('thead')
  const tbody = document.getElementById('tbody')
  const keys = state.round === 2 ? ['lula', 'flavio'] : CANDIDATES.map((c) => c.key)
  thead.innerHTML = `<tr><th>Campo</th><th>Instituto</th><th>N</th><th>Margem</th>${keys
    .map((k) => `<th>${CANDIDATES.find((c) => c.key === k).label}</th>`)
    .join('')}<th>Fonte</th></tr>`
  const rows = [...activePolls()].reverse()
  tbody.innerHTML = rows
    .map((p) => {
      const cells = keys
        .map((k) => {
          const v = p.results[k]
          return `<td class="num">${v == null ? '—' : v.toLocaleString('pt-BR')}</td>`
        })
        .join('')
      const link = p.sourceUrl
        ? `<a href="${p.sourceUrl}" target="_blank" rel="noopener noreferrer">ver</a>`
        : '—'
      return `<tr>
        <td>${fmtDateBR(p.fieldworkStart)}–${fmtDateBR(p.fieldworkEnd)}</td>
        <td>${escapeHtml(p.institute)}</td>
        <td class="num">${p.n?.toLocaleString('pt-BR') ?? '—'}</td>
        <td class="num">${p.moeRaw || (p.moe != null ? '±' + p.moe : '—')}</td>
        ${cells}
        <td>${link}</td>
      </tr>`
    })
    .join('')
}

function refresh() {
  renderLegend()
  renderCards()
  renderTable()
  if (state.chart) {
    updatePollChart(state.chart, chartOpts())
  }
  setStamp()
}

function countLabel() {
  const r1 = state.polls.filter((p) => p.round === 1).length
  const r2 = state.polls.filter((p) => p.round === 2).length
  return `${r1} pesquisas de 1º turno · ${r2} de 2º turno`
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

boot()
