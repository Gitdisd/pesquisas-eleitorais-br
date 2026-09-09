import './layout-fix.css'

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
  document.body.dataset.layoutFixed = '1'
  return true
}

const started = Date.now()
const id = setInterval(() => {
  injectVerifyButton()
  layoutFix()
  if (document.body.dataset.layoutFixed === '1' || Date.now() - started > 15000) clearInterval(id)
}, 200)
