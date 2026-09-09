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

  const extra = document.querySelector('header .refresh-notice')
  if (extra) extra.remove()

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

function layoutFix() {
  if (document.body.dataset.layoutFixed === '1') return
  const stack = document.querySelector('main.main-stack')
  const cards = document.getElementById('cards')
  const chart = document.getElementById('chartPanel')
  if (!stack || !cards || !chart) return

  const tablePanel = [...stack.querySelectorAll(':scope > .panel')].find((p) => p.querySelector('#tbody'))
  const metodo = [...stack.querySelectorAll(':scope > .panel')].find((p) => p.classList.contains('metodologia'))

  stack.insertBefore(cards, chart)
  if (!document.getElementById('cardsNote')) {
    const note = document.createElement('p')
    note.id = 'cardsNote'
    note.className = 'cards-note'
    note.textContent = 'Média ponderada 14 dias — pesquisas nacionais apenas. Não inclui SP/MG.'
    cards.after(note)
  }

  if (tablePanel) {
    tablePanel.classList.add('panel-table')
    tablePanel.id = tablePanel.id || 'nationalTablePanel'
    const h = tablePanel.querySelector('h2')
    if (h) h.textContent = 'Tabela nacional'
    chart.after(tablePanel)
  }

  const below = chart.querySelector('.chart-below')
  if (below && !document.getElementById('chartOpts')) {
    const det = document.createElement('details')
    det.id = 'chartOpts'
    det.className = 'opts-fold'
    const sum = document.createElement('summary')
    sum.textContent = 'Opções do gráfico (janela, institutos, eixos)'
    det.append(sum, below)
    chart.appendChild(det)
  }

  const title = chart.querySelector('.chart-title')
  if (title) title.textContent = 'Nacional — evolução da intenção de voto'

  const regional = document.getElementById('allSourcesPanel')
  if (regional && metodo) stack.insertBefore(regional, metodo)
  else if (regional && tablePanel) tablePanel.after(regional)

  document.body.dataset.layoutFixed = '1'
}

function addTseHeaderIfMissing() {
  const table = document.querySelector('#nationalTablePanel table.polls, .panel-table table.polls')
  if (!table) return
  const ths = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim())
  if (!ths.length || ths.includes('TSE')) return
  const inst = [...table.querySelectorAll('thead th')].find((th) => th.textContent.trim() === 'Instituto')
  if (!inst) return
  const th = document.createElement('th')
  th.textContent = 'TSE'
  inst.after(th)
  table.querySelectorAll('tbody tr').forEach((tr) => {
    const td = document.createElement('td')
    td.textContent = '—'
    tr.children[1]?.after(td)
  })
}

const started = Date.now()
const id = setInterval(() => {
  const ok = injectVerifyButton()
  if (ok) {
    layoutFix()
    addTseHeaderIfMissing()
  }
  if ((ok && document.body.dataset.layoutFixed === '1') || Date.now() - started > 15000) {
    layoutFix()
    clearInterval(id)
  }
}, 200)
