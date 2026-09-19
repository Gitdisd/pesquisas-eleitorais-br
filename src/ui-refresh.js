import './ui-refresh.css'
import { CANDIDATES } from './candidates.js'
import { canonicalPollKey } from './data/identity.js'
import { formatCount, latestDate, daysSince, freshnessClass } from './ui-upgrades.js'

const BASE = import.meta.env.BASE_URL
let mounted = false
let decorating = false
let sparkRowsPromise = null
let mainObserver = null
let tableObserver = null
let decorateTimer = null

function isoForDate(text) {
  if (!text) return ''
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00Z` : text
}

function brDate(text) {
  if (!text) return '—'
  const d = new Date(isoForDate(text))
  return Number.isNaN(d.getTime()) ? text : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

async function getPublishedStats() {
  const [pollRes, extraRes, metaRes] = await Promise.all([
    fetch(`${BASE}data/polls.json?ui=${Date.now()}`, { cache: 'no-store' }),
    fetch(`${BASE}data/polls-extra.json?ui=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
    fetch(`${BASE}data/meta.json?ui=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
  ])
  const base = pollRes.ok ? await pollRes.json() : []
  let extra = []
  if (extraRes?.ok) {
    try { extra = await extraRes.json() } catch {}
  }
  const rows = [
    ...(Array.isArray(base) ? base : base?.polls || []),
    ...(Array.isArray(extra) ? extra : extra?.polls || []),
  ]
  const seen = new Set()
  const unique = rows.filter((p) => {
    const key = canonicalPollKey(p)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const meta = metaRes?.ok ? await metaRes.json().catch(() => null) : null
  return { rows: unique, meta }
}

function injectHeaderBrand() {
  const text = document.querySelector('.hdr-text')
  if (!text || text.querySelector('.app-brandline')) return
  const line = document.createElement('div')
  line.className = 'app-brandline'
  line.innerHTML = '<span class="app-kicker">Painel de acompanhamento</span><span class="live-pill"><i class="live-dot"></i>dados públicos</span>'
  text.prepend(line)
}

function ensureIds() {
  const table = document.querySelector('table.polls')
  const panel = table?.closest('.panel')
  if (panel && !panel.id) panel.id = 'pollsPanel'
  const method = document.querySelector('.metodologia')
  if (method && !method.id) method.id = 'methodology'
}

function addNav() {
  const header = document.querySelector('.app-hdr .wrap')
  const main = document.querySelector('main.wrap')
  if (!header || !main || header.querySelector('.dashboard-nav')) return
  const nav = document.createElement('nav')
  nav.className = 'dashboard-nav'
  nav.setAttribute('aria-label', 'Navegação rápida')
  nav.innerHTML = [
    ['#overview', 'Visão geral'], ['#chartPanel', 'Gráfico'], ['#cards', 'Resumo'],
    ['#pollsPanel', 'Pesquisas'], ['#methodology', 'Metodologia'],
  ].map(([href, label]) => `<a href="${href}">${label}</a>`).join('')
  header.appendChild(nav)

  const mobile = document.createElement('nav')
  mobile.className = 'mobile-nav'
  mobile.setAttribute('aria-label', 'Navegação rápida móvel')
  mobile.innerHTML = [
    ['#overview', '⌂', 'Início'], ['#chartPanel', '⌁', 'Gráfico'],
    ['#cards', '▦', 'Resumo'], ['#pollsPanel', '≡', 'Pesquisas'],
  ].map(([href, icon, label]) => `<a href="${href}"><span class="nav-icon">${icon}</span>${label}</a>`).join('')
  main.appendChild(mobile)
}

function addOverview(stats) {
  const main = document.querySelector('main.wrap')
  const chart = document.getElementById('chartPanel')
  if (!main || !chart || document.getElementById('overview')) return
  const { rows, meta } = stats
  const institutes = new Set(rows.map((p) => p.institute).filter(Boolean)).size
  const latest = latestDate(rows)
  const age = daysSince(latest)
  const round1 = rows.filter((p) => /primeiro|1.?\s*turno/i.test(p.scenario || '')).length
  const round2 = rows.filter((p) => /segundo|2.?\s*turno/i.test(p.scenario || '')).length
  const section = document.createElement('section')
  section.className = 'dashboard-overview'
  section.id = 'overview'
  section.innerHTML = `
    <div class="overview-hero"><div><h2>Visão geral do conjunto de pesquisas</h2><p>Um resumo rápido antes de entrar no gráfico e na tabela. Nada aqui altera os cálculos do site.</p></div>
      <div class="overview-actions"><button class="ui-btn" type="button" data-scroll="#chartPanel">Abrir gráfico</button><button class="ui-btn" type="button" data-scroll="#pollsPanel">Ver pesquisas</button></div></div>
    <div class="metrics-grid">
      <div class="metric"><span class="metric-label">Pesquisas publicadas</span><span class="metric-value">${formatCount(meta?.record_count || rows.length)}</span><span class="metric-sub">base nacional publicada</span></div>
      <div class="metric"><span class="metric-label">Institutos</span><span class="metric-value">${formatCount(institutes)}</span><span class="metric-sub">presentes nos dados carregados</span></div>
      <div class="metric"><span class="metric-label">Campo mais recente</span><span class="metric-value ${freshnessClass(age)}">${brDate(latest)}</span><span class="metric-sub">${age == null ? 'sem data' : age === 0 ? 'realizado hoje' : `há ${age} dia${age === 1 ? '' : 's'}`}</span></div>
      <div class="metric"><span class="metric-label">Cobertura por turno</span><span class="metric-value">${formatCount(round1)} · ${formatCount(round2)}</span><span class="metric-sub">1º turno · 2º turno</span></div>
    </div>`
  main.insertBefore(section, chart)
  section.querySelectorAll('[data-scroll]').forEach((btn) => btn.addEventListener('click', () => document.querySelector(btn.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
}

function addChartActions() {
  const panel = document.getElementById('chartPanel')
  const title = panel?.querySelector('.chart-title')
  if (!panel || !title || panel.querySelector('.chart-head-row')) return
  const row = document.createElement('div')
  row.className = 'chart-head-row'
  title.parentNode.insertBefore(row, title)
  row.appendChild(title)
  const actions = document.createElement('div')
  actions.className = 'chart-actions'
  actions.innerHTML = '<button type="button" class="ui-btn" data-chart-focus>↗ focar</button><button type="button" class="ui-btn" data-chart-fullscreen>⛶ tela cheia</button>'
  row.appendChild(actions)
  actions.querySelector('[data-chart-focus]').addEventListener('click', () => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  actions.querySelector('[data-chart-fullscreen]').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await panel.requestFullscreen?.() } catch {}
  })
}

function convertInstituteFilters() {
  const institutes = document.getElementById('institutes')
  if (!institutes || institutes.closest('.filter-drawer')) return
  const drawer = document.createElement('details')
  drawer.className = 'filter-drawer'
  const summary = document.createElement('summary')
  summary.textContent = 'Filtros por instituto'
  drawer.appendChild(summary)
  const meta = document.createElement('div')
  meta.className = 'filter-meta'
  meta.textContent = 'Use os chips para incluir ou excluir institutos do gráfico e do resumo.'
  drawer.appendChild(meta)
  institutes.parentNode.insertBefore(drawer, institutes)
  drawer.appendChild(institutes)
}

function candidateColor(key) {
  const styles = getComputedStyle(document.documentElement)
  const map = { lula: '--c-lula', flavio: '--c-flavio', cury: '--c-cury', renan: '--c-renan', caiado: '--c-caiado', zema: '--c-zema' }
  return styles.getPropertyValue(map[key] || '--accent').trim() || '#2563eb'
}

function buildSparkMap(rows) {
  const map = new Map(CANDIDATES.map((c) => [c.key, []]))
  for (const p of rows) {
    if (p.round && p.round !== 1) continue
    const t = p.fieldwork_end || p.published_date
    if (!t) continue
    for (const c of CANDIDATES) {
      const firstName = c.label.toLowerCase().split(' ')[0]
      const hit = (p.candidates || []).find((x) => String(x.name || '').toLowerCase().includes(firstName))
      const value = Number(String(hit?.pct ?? '').replace(',', '.'))
      if (Number.isFinite(value)) map.get(c.key).push({ t, value })
    }
  }
  return map
}

async function loadSparkRows() {
  if (sparkRowsPromise) return sparkRowsPromise
  sparkRowsPromise = fetch(`${BASE}data/polls.json?cards=1`, { cache: 'force-cache' })
    .then((res) => res.ok ? res.json() : [])
    .then((data) => Array.isArray(data) ? data : data?.polls || [])
    .catch(() => [])
  return sparkRowsPromise
}

async function enrichCardSparklines() {
  const container = document.getElementById('cards')
  if (!container || container.querySelector('.card-spark')) return
  const rows = await loadSparkRows()
  if (!container.isConnected) return
  const map = buildSparkMap(rows)
  for (const card of container.querySelectorAll('.card')) {
    if (card.querySelector('.card-spark')) continue
    const pts = (map.get(card.dataset.c || '') || []).slice(-8)
    if (pts.length < 2) continue
    const min = Math.min(...pts.map((p) => p.value)); const max = Math.max(...pts.map((p) => p.value)); const span = max - min || 1
    const coords = pts.map((p, i) => `${((i / (pts.length - 1)) * 100).toFixed(1)},${(26 - ((p.value - min) / span) * 20).toFixed(1)}`).join(' ')
    const spark = document.createElement('div')
    spark.className = 'card-spark'
    spark.innerHTML = `<svg viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label="Tendência recente de ${card.querySelector('.name')?.textContent || 'candidato'}"><polyline points="${coords}" style="color:${candidateColor(card.dataset.c)}"></polyline></svg>`
    card.appendChild(spark)
  }
}

function decorateCards() {
  const container = document.getElementById('cards')
  if (!container) return
  for (const card of container.querySelectorAll('.card')) {
    if (card.querySelector('.card-topline')) continue
    const name = card.querySelector('.name')
    const val = card.querySelector('.val')
    if (name) {
      const top = document.createElement('div')
      top.className = 'card-topline'
      const caption = document.createElement('span')
      caption.className = 'card-caption'
      caption.textContent = 'média selecionada'
      top.append(name, caption)
      card.prepend(top)
    }
    if (val) val.title = 'Valor atual estimado pela janela/modelo selecionados.'
  }
  enrichCardSparklines()
}

function enhanceTable() {
  const table = document.querySelector('table.polls')
  const panel = table?.closest('.panel')
  if (!table || !panel || panel.querySelector('.table-toolbar')) return
  const heading = panel.querySelector('h2')
  if (!heading) return
  const wrap = document.createElement('div')
  wrap.className = 'table-toolbar'
  const title = document.createElement('h2')
  title.className = 'table-title'; title.textContent = heading.textContent
  const tools = document.createElement('div'); tools.className = 'table-tools'
  const search = document.createElement('input')
  search.className = 'table-search'; search.type = 'search'; search.placeholder = 'Filtrar instituto ou campo…'; search.setAttribute('aria-label', 'Filtrar tabela de pesquisas')
  const count = document.createElement('span'); count.className = 'table-count'
  tools.append(search, count); wrap.append(title, tools); heading.replaceWith(wrap)
  const apply = () => {
    const q = search.value.trim().toLocaleLowerCase('pt-BR')
    let visible = 0
    for (const tr of panel.querySelectorAll('tbody tr')) { const show = !q || tr.textContent.toLocaleLowerCase('pt-BR').includes(q); tr.hidden = !show; if (show) visible++ }
    count.textContent = `${visible.toLocaleString('pt-BR')} linhas`
  }
  search.addEventListener('input', apply)
  tableObserver?.disconnect()
  tableObserver = new MutationObserver(apply)
  const body = table.querySelector('tbody')
  if (body) tableObserver.observe(body, { childList: true })
  apply()
}

function addGuideNote() {
  const chart = document.getElementById('chartPanel')
  if (!chart || chart.querySelector('.quick-note')) return
  const note = document.createElement('div')
  note.className = 'quick-note'
  note.innerHTML = '<span class="quick-note-icon">i</span><span><strong>Como usar:</strong> selecione o turno, ajuste a janela da média e toque em um ponto do gráfico para ler instituto, amostra e margem de erro. Os filtros por instituto afetam o gráfico e o resumo.</span>'
  chart.querySelector('.chart-below')?.prepend(note)
}

function refreshDecorations() {
  if (decorating) return
  decorating = true
  try { ensureIds(); injectHeaderBrand(); addNav(); addChartActions(); convertInstituteFilters(); decorateCards(); enhanceTable(); addGuideNote() } finally { decorating = false }
}

function scheduleDecorations() {
  clearTimeout(decorateTimer)
  decorateTimer = window.setTimeout(refreshDecorations, 50)
}

async function mount() {
  if (mounted) return
  const chart = document.getElementById('chartPanel')
  const cards = document.getElementById('cards')
  if (!chart || !cards) return
  mounted = true
  document.body.classList.add('pebr-enhanced')
  try { addOverview(await getPublishedStats()) } catch { addOverview({ rows: [], meta: null }) }
  refreshDecorations()
  mainObserver = new MutationObserver(scheduleDecorations)
  mainObserver.observe(document.querySelector('main.wrap') || document.body, { childList: true, subtree: true })
}

const bootWait = window.setInterval(() => {
  mount()
  if (mounted) window.clearInterval(bootWait)
}, 150)
