import './layout-fix.css'
import './crt-theme.css'
import { Chart } from 'chart.js'

const THEME_ORDER = ['light', 'dark', 'crt-amber', 'crt-green']
const THEME_NEXT_LABEL = {
  light: 'Escuro',
  dark: 'CRT âmbar',
  'crt-amber': 'CRT verde',
  'crt-green': 'Claro',
}

function tintCharts() {
  const t = document.documentElement.getAttribute('data-theme') || 'light'
  const crt = t.startsWith('crt')
  const amber = t === 'crt-amber'
  const grid = crt
    ? amber
      ? 'rgba(255,176,0,.16)'
      : 'rgba(61,255,122,.14)'
    : t === 'dark'
      ? 'rgba(255,255,255,.08)'
      : 'rgba(0,0,0,.06)'
  const tick = crt ? (amber ? '#c48420' : '#1fa34d') : t === 'dark' ? '#a8b0ba' : '#5c6570'
  const title = crt ? (amber ? '#ffb000' : '#3dff7a') : t === 'dark' ? '#e8eaed' : '#1a1d21'
  document.querySelectorAll('canvas').forEach((el) => {
    const ch = Chart.getChart(el)
    if (!ch?.options?.scales) return
    if (ch.options.scales.x?.grid) ch.options.scales.x.grid.color = grid
    if (ch.options.scales.y?.grid) ch.options.scales.y.grid.color = grid
    if (ch.options.scales.x?.ticks) ch.options.scales.x.ticks.color = tick
    if (ch.options.scales.y?.ticks) ch.options.scales.y.ticks.color = tick
    if (ch.options.scales.y?.title) ch.options.scales.y.title.color = title
    ch.update('none')
  })
}

function applyCrtTheme(theme) {
  const t = THEME_ORDER.includes(theme) ? theme : 'light'
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : t)
  localStorage.setItem('pebr-theme', t)
  const btn = document.getElementById('themeToggle')
  if (btn) btn.textContent = THEME_NEXT_LABEL[t]
  tintCharts()
}

function installThemeCycle() {
  const btn = document.getElementById('themeToggle')
  if (!btn || btn.dataset.crtCycle) return false
  btn.dataset.crtCycle = '1'
  const saved = localStorage.getItem('pebr-theme')
  if (THEME_ORDER.includes(saved)) applyCrtTheme(saved)
  btn.addEventListener(
    'click',
    (ev) => {
      ev.stopImmediatePropagation()
      const cur = document.documentElement.getAttribute('data-theme') || 'light'
      const i = Math.max(0, THEME_ORDER.indexOf(cur))
      applyCrtTheme(THEME_ORDER[(i + 1) % THEME_ORDER.length])
    },
    true,
  )
  return true
}

function injectVerifyButton() {
  if (document.getElementById('verifyNow')) return true
  const timer = document.getElementById('checkTimer')
  if (!timer) return false

  const wrap = document.createElement('div')
  wrap.className = 'hdr-actions'
  wrap.id = 'hdrActions'

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.id = 'verifyNow'
  btn.className = 'theme-toggle'
  btn.textContent = 'Verificar agora'

  const link = document.createElement('a')
  link.className = 'theme-toggle hdr-link'
  link.href = 'https://github.com/Gitdisd/pesquisas-eleitorais-br/actions/workflows/refresh-polls.yml'
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = 'Busca no GitHub'

  wrap.append(btn, link)
  timer.after(wrap)
  document.querySelectorAll('header .refresh-notice').forEach((n) => n.remove())

  btn.addEventListener('click', async () => {
    btn.disabled = true
    btn.textContent = 'Recarregando…'
    try {
      const t = Date.now()
      await Promise.all([
        fetch(`data/polls.json?t=${t}`, { cache: 'no-store' }),
        fetch(`data/meta.json?t=${t}`, { cache: 'no-store' }),
      ])
      window.location.reload()
    } catch (err) {
      btn.textContent = 'Falhou — tente de novo'
      btn.disabled = false
    }
  })
  return true
}

function setProjModel(n) {
  window.__pebrProjModel = n
  const box = document.getElementById('projectionToggle')
  if (box) {
    box.checked = n > 0
    box.dispatchEvent(new Event('change', { bubbles: true }))
  }
  document.querySelectorAll('[data-proj-model]').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.projModel) === n)
  })
  const hint = document.getElementById('projDisclaimer')
  if (hint) {
    hint.classList.toggle('on', n > 0)
    hint.textContent =
      n === 2
        ? 'Modelo 2: pesquisas com viés de instituto removido + teste nos últimos 7 dias. Se o modelo não ganha de “ficar parado”, a linha some. Não é prognóstico de urna.'
        : n === 1
          ? 'Modelo 1: régua amortecida sobre a média ponderada. Não é pesquisa nova nem probabilidade de vitória.'
          : hint.textContent
  }
}

function injectModelToggles() {
  if (document.getElementById('projModelRow')) return !!document.getElementById('projectionToggle')
  const host = document.getElementById('projToggleLabel')?.parentElement || document.querySelector('.controls-secondary')
  if (!host) return false

  const row = document.createElement('div')
  row.id = 'projModelRow'
  row.className = 'proj-model-row'
  row.innerHTML = `
    <span class="ctrl">Projeção</span>
    <button type="button" class="chip" data-proj-model="0">off</button>
    <button type="button" class="chip" data-proj-model="1">Modelo 1</button>
    <button type="button" class="chip" data-proj-model="2">Modelo 2</button>
  `
  host.prepend(row)
  row.querySelectorAll('[data-proj-model]').forEach((b) => {
    b.addEventListener('click', () => setProjModel(Number(b.dataset.projModel)))
  })

  if (!document.getElementById('projSummary')) {
    const p = document.createElement('p')
    p.id = 'projSummary'
    p.className = 'hint proj-summary'
    host.appendChild(p)
  }
  setProjModel(Number(window.__pebrProjModel || 0))
  return true
}

function layoutFix() {
  const stack = document.querySelector('main.main-stack')
  const cards = document.getElementById('cards')
  const chart = document.getElementById('chartPanel')
  if (!stack || !cards || !chart) return false

  const tablePanel = [...stack.querySelectorAll(':scope > .panel')].find((p) => p.querySelector('#tbody'))
  const metodo = [...stack.querySelectorAll(':scope > .panel')].find((p) => p.classList.contains('metodologia'))

  if (cards.nextElementSibling !== chart && cards !== chart.previousElementSibling) {
    stack.insertBefore(cards, chart)
  }
  if (!document.getElementById('cardsNote')) {
    const note = document.createElement('p')
    note.id = 'cardsNote'
    note.className = 'cards-note'
    note.textContent = 'Média ponderada 14 dias — pesquisas nacionais apenas. Não inclui SP/MG.'
    cards.after(note)
  }

  if (tablePanel) {
    tablePanel.classList.add('panel-table')
    tablePanel.id = 'nationalTablePanel'
    const h = tablePanel.querySelector('h2')
    if (h) h.textContent = 'Tabela nacional'
    if (tablePanel.previousElementSibling !== chart) chart.after(tablePanel)
  }

  const below = chart.querySelector('.chart-below')
  if (below && !document.getElementById('chartOpts')) {
    const det = document.createElement('details')
    det.id = 'chartOpts'
    det.className = 'opts-fold'
    det.open = true
    const sum = document.createElement('summary')
    sum.textContent = 'Opções do gráfico (projeção, janela, institutos)'
    det.append(sum, below)
    chart.appendChild(det)
  }

  const title = chart.querySelector('.chart-title')
  if (title) title.textContent = 'Nacional — evolução da intenção de voto'

  const regional = document.getElementById('allSourcesPanel')
  if (regional) {
    if (metodo) stack.insertBefore(regional, metodo)
    else if (tablePanel) tablePanel.after(regional)
  }

  injectModelToggles()
  installThemeCycle()
  document.body.dataset.layoutFixed = '1'
  return true
}

const started = Date.now()
const id = setInterval(() => {
  injectVerifyButton()
  layoutFix()
  if (document.body.dataset.layoutFixed === '1' || Date.now() - started > 15000) clearInterval(id)
}, 200)
