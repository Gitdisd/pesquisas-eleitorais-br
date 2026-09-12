import './layout-fix.css'
import './crt-theme.css'
import './party-themes.css'
import { Chart } from 'chart.js'

const BASE_THEMES = ['light', 'dark', 'crt-amber', 'crt-green']
const PARTY_THEMES = [
  { id: 'party-pt', label: 'PT' },
  { id: 'party-pl', label: 'PL' },
  { id: 'party-missao', label: 'Missão' },
  { id: 'party-psd', label: 'PSD' },
  { id: 'party-novo', label: 'Novo' },
  { id: 'party-avante', label: 'Avante' },
]
const ALL_THEMES = [...BASE_THEMES, ...PARTY_THEMES.map((p) => p.id)]
const THEME_NEXT_LABEL = {
  light: 'Escuro',
  dark: 'CRT âmbar',
  'crt-amber': 'CRT verde',
  'crt-green': 'Claro',
}

function chartTint(theme) {
  if (theme === 'crt-amber') return { grid: 'rgba(255,176,0,.16)', tick: '#c48420', title: '#ffb000' }
  if (theme === 'crt-green') return { grid: 'rgba(61,255,122,.14)', tick: '#1fa34d', title: '#3dff7a' }
  if (theme === 'party-pt') return { grid: 'rgba(255,255,255,.12)', tick: '#f3c4c8', title: '#fff8f6' }
  if (theme === 'party-pl') return { grid: 'rgba(255,210,0,.14)', tick: '#d4c07a', title: '#ffe9a0' }
  if (theme === 'party-missao') return { grid: 'rgba(252,190,38,.16)', tick: '#d7a31c', title: '#fcbe26' }
  if (theme === 'party-psd') return { grid: 'rgba(255,164,0,.16)', tick: '#e0b46a', title: '#ffe4b0' }
  if (theme === 'party-novo') return { grid: 'rgba(236,103,28,.16)', tick: '#f0b48a', title: '#ffe8d6' }
  if (theme === 'party-avante') return { grid: 'rgba(46,171,177,.16)', tick: '#9ad4d8', title: '#e8ffff' }
  if (theme === 'dark') return { grid: 'rgba(255,255,255,.08)', tick: '#a8b0ba', title: '#e8eaed' }
  return { grid: 'rgba(0,0,0,.06)', tick: '#5c6570', title: '#1a1d21' }
}

function tintCharts() {
  const t = document.documentElement.getAttribute('data-theme') || 'light'
  const tc = chartTint(t)
  document.querySelectorAll('canvas').forEach((el) => {
    const ch = Chart.getChart(el)
    if (!ch?.options?.scales) return
    if (ch.options.scales.x?.grid) ch.options.scales.x.grid.color = tc.grid
    if (ch.options.scales.y?.grid) ch.options.scales.y.grid.color = tc.grid
    if (ch.options.scales.x?.ticks) ch.options.scales.x.ticks.color = tc.tick
    if (ch.options.scales.y?.ticks) ch.options.scales.y.ticks.color = tc.tick
    if (ch.options.scales.y?.title) ch.options.scales.y.title.color = tc.title
    ch.update('none')
  })
}

function applySiteTheme(theme) {
  const t = ALL_THEMES.includes(theme) ? theme : 'dark'
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : t)
  localStorage.setItem('pebr-theme', t)
  const btn = document.getElementById('themeToggle')
  if (btn) btn.textContent = THEME_NEXT_LABEL[t] || 'Claro'
  document.querySelectorAll('[data-party-theme]').forEach((b) => {
    b.classList.toggle('on', b.dataset.partyTheme === t)
  })
  tintCharts()
}

function installThemeCycle() {
  const btn = document.getElementById('themeToggle')
  if (!btn || btn.dataset.crtCycle) return false
  btn.dataset.crtCycle = '1'
  const saved = localStorage.getItem('pebr-theme')
  if (ALL_THEMES.includes(saved)) applySiteTheme(saved)
  btn.addEventListener(
    'click',
    (ev) => {
      ev.stopImmediatePropagation()
      const cur = document.documentElement.getAttribute('data-theme') || 'light'
      const i = Math.max(0, BASE_THEMES.indexOf(cur))
      applySiteTheme(BASE_THEMES[(i + 1) % BASE_THEMES.length])
    },
    true,
  )
  return true
}

function injectPartyThemes() {
  if (document.getElementById('partyThemes')) return true
  const header = document.querySelector('header.app-hdr .hdr-text') || document.querySelector('header.app-hdr')
  if (!header) return false
  const row = document.createElement('div')
  row.id = 'partyThemes'
  row.className = 'party-themes'
  row.setAttribute('aria-label', 'Temas das bandeiras partidárias')
  PARTY_THEMES.forEach((p) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.dataset.partyTheme = p.id
    b.textContent = p.label
    b.addEventListener('click', () => applySiteTheme(p.id))
    row.appendChild(b)
  })
  header.appendChild(row)
  const saved = localStorage.getItem('pebr-theme')
  if (saved) applySiteTheme(saved)
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
    note.textContent = 'Média ponderada: √n + meia-vida 14d (chip muda a janela). Só nacionais.'
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
  injectPartyThemes()
  document.body.dataset.layoutFixed = '1'
  return true
}

const started = Date.now()
const id = setInterval(() => {
  injectVerifyButton()
  layoutFix()
  if (document.body.dataset.layoutFixed === '1' || Date.now() - started > 15000) clearInterval(id)
}, 200)
