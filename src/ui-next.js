import * as echarts from 'echarts'
import { CANDIDATES } from './candidates.js'

const STYLE_ID = 'pebr-ui-next-style'
let mounted = false

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .next-tools{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0 .7rem}
    .next-tool{border:1px solid var(--border);background:var(--chip-bg);color:var(--text);border-radius:10px;padding:.45rem .65rem;font:inherit;font-size:.75rem;min-height:38px;cursor:pointer}
    .next-tool:hover,.next-tool:focus-visible{border-color:var(--accent);outline:none;box-shadow:var(--ring)}
    .next-tool.primary{background:var(--text);color:var(--surface);border-color:var(--text)}
    html[data-theme=dark] .next-tool.primary{background:#e8eaed;color:#0f1216;border-color:#e8eaed}
    .candidate-focus{display:flex;flex-wrap:wrap;gap:.35rem;margin:.2rem 0 .65rem}
    .candidate-focus-label{width:100%;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}
    .candidate-focus button{border:1px solid var(--border);background:var(--chip-bg);color:var(--text);border-radius:999px;padding:.3rem .55rem;font:inherit;font-size:.72rem;cursor:pointer;min-height:32px}
    .candidate-focus button[aria-pressed=true]{font-weight:700;background:var(--chip-on-bg);border-color:var(--chip-on-border)}
    .candidate-focus button:disabled{opacity:.42;cursor:not-allowed}
    .data-toast{position:fixed;left:50%;bottom:1rem;transform:translate(-50%,120%);opacity:0;transition:transform .2s ease,opacity .2s ease;background:var(--text);color:var(--surface);padding:.55rem .8rem;border-radius:10px;z-index:100;font-size:.76rem;box-shadow:0 8px 30px rgba(0,0,0,.25);pointer-events:none}
    .data-toast.show{transform:translate(-50%,0);opacity:1}
    .scroll-top{position:fixed;right:1rem;bottom:1rem;z-index:35;border:1px solid var(--border);background:var(--glass);color:var(--text);backdrop-filter:blur(12px);border-radius:50%;width:42px;height:42px;display:none;cursor:pointer;box-shadow:0 5px 20px rgba(0,0,0,.16)}
    .scroll-top.show{display:block}
    @media(max-width:600px){.next-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.next-tool{width:100%}.scroll-top{bottom:5.6rem;right:.85rem}}
  `
  document.head.appendChild(style)
}

function toast(message) {
  let el = document.querySelector('.data-toast')
  if (!el) {
    el = document.createElement('div')
    el.className = 'data-toast'
    el.setAttribute('role', 'status')
    document.body.appendChild(el)
  }
  el.textContent = message
  el.classList.add('show')
  clearTimeout(el._timer)
  el._timer = setTimeout(() => el.classList.remove('show'), 1800)
}

function getChart() {
  const el = document.querySelector('#chartPanel .echarts-container')
  return el ? echarts.getInstanceByDom(el) : null
}

function syncCandidateButtons() {
  const chart = getChart()
  const labels = new Set((chart?.getOption()?.series || []).map((s) => s.name))
  for (const btn of document.querySelectorAll('.candidate-focus button[data-candidate]')) {
    const label = btn.dataset.candidate
    const available = labels.has(label) || labels.has(label + ' (média)')
    btn.disabled = !available
    if (!available) btn.setAttribute('aria-pressed', 'false')
  }
}

function addCandidateFocus() {
  const panel = document.getElementById('chartPanel')
  const anchor = panel?.querySelector('.chart-below')
  if (!panel || !anchor || panel.querySelector('.candidate-focus')) return
  const row = document.createElement('div')
  row.className = 'candidate-focus'
  row.innerHTML = '<span class="candidate-focus-label">Linhas do gráfico</span>'
  const candidates = CANDIDATES.filter((c) => c.key !== 'branco_nulo')
  for (const candidate of candidates) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = candidate.label
    btn.dataset.candidate = candidate.label
    btn.setAttribute('aria-pressed', 'true')
    btn.title = `Mostrar ou ocultar ${candidate.label} no gráfico`
    btn.addEventListener('click', () => {
      const chart = getChart()
      if (!chart || btn.disabled) return
      const visible = btn.getAttribute('aria-pressed') === 'true'
      const names = [candidate.label, candidate.label + ' (média)']
      for (const name of names) {
        chart.dispatchAction({ type: visible ? 'legendUnSelect' : 'legendSelect', name })
      }
      btn.setAttribute('aria-pressed', String(!visible))
    })
    row.appendChild(btn)
  }
  anchor.prepend(row)
  syncCandidateButtons()
}

function addQuickTools() {
  const panel = document.getElementById('chartPanel')
  const anchor = panel?.querySelector('.chart-below')
  if (!panel || !anchor || panel.querySelector('.next-tools')) return
  const tools = document.createElement('div')
  tools.className = 'next-tools'
  tools.setAttribute('aria-label', 'Ações rápidas')
  tools.innerHTML = `
    <button type="button" class="next-tool primary" data-next-share>Compartilhar</button>
    <button type="button" class="next-tool" data-next-csv>Exportar tabela CSV</button>
    <button type="button" class="next-tool" data-next-json>Exportar JSON</button>
    <button type="button" class="next-tool" data-next-focus>Focar gráfico</button>
    <button type="button" class="next-tool" data-next-reset>Restaurar visualização</button>`
  anchor.prepend(tools)

  tools.querySelector('[data-next-focus]').addEventListener('click', () => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  tools.querySelector('[data-next-reset]').addEventListener('click', () => {
    document.getElementById('resetZoom')?.click()
    const chart = getChart()
    if (chart) for (const item of chart.getOption().series || []) chart.dispatchAction({ type: 'legendSelect', name: item.name })
    for (const b of panel.querySelectorAll('.candidate-focus button')) b.setAttribute('aria-pressed', 'true')
    syncCandidateButtons()
    chart?.resize()
    toast('Visualização restaurada')
  })
  tools.querySelector('[data-next-share]').addEventListener('click', async () => {
    const url = buildShareUrl()
    const share = { title: document.title, text: 'Pesquisas eleitorais — Presidência 2026', url }
    try {
      if (navigator.share) await navigator.share(share)
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); toast('Link copiado') }
      else toast('Compartilhamento não disponível neste navegador')
    } catch (err) {
      if (err?.name !== 'AbortError') toast('Não foi possível compartilhar')
    }
  })
  tools.querySelector('[data-next-csv]').addEventListener('click', exportVisibleTable)
  tools.querySelector('[data-next-json]').addEventListener('click', exportJson)
}

function buildShareUrl() {
  const url = new URL(location.href)
  const view = window.__pebr?.view || {}
  const params = new URLSearchParams()
  if (view.round === 1 || view.round === 2) params.set('round', String(view.round))
  if (view.rangeDays == null) params.set('range', 'all')
  else if (Number.isFinite(view.rangeDays)) params.set('range', String(view.rangeDays))
  if (view.windowPreset && view.windowPreset !== 'custom' && view.windowPreset !== 'ytd') params.set('window', String(view.windowPreset))
  else if (view.windowPreset === 'ytd') params.set('window', 'ytd')
  else if (Number.isFinite(view.windowDays)) params.set('window', String(view.windowDays))
  if (Array.isArray(view.institutes) && view.institutes.length) params.set('institutes', view.institutes.map((x) => encodeURIComponent(x)).join(','))
  if (Number.isInteger(view.model)) params.set('model', String(view.model))
  url.search = params.toString()
  url.hash = ''
  return url.toString()
}

function exportJson() {
  const store = window.__pebr
  if (!store) return
  const view = store.view || {}
  const round = Number(view.round || 1)
  const institutes = new Set(Array.isArray(view.institutes) ? view.institutes : [])
  const rows = (store.raw || []).filter((p) => {
    const scenario = String(p.scenario || '').toLowerCase()
    const isRound = round === 2 ? /2[ºo°]?\s*turno|segundo\s*turno/.test(scenario) : /1[ºo°]?\s*turno|primeiro\s*turno|estimulada/.test(scenario)
    return isRound && (!institutes.size || institutes.has(p.institute))
  })
  const payload = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    source: 'window.__pebr',
    view,
    record_count: rows.length,
    polls: rows,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `pesquisas-eleitorais-${new Date().toISOString().slice(0,10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
  toast('JSON exportado')
}

function exportVisibleTable() {
  const table = document.querySelector('table.polls')
  if (!table) return
  const rows = [...table.querySelectorAll('tr')].filter((tr) => !tr.hidden)
  const csv = rows.map((tr) => [...tr.children].map((cell) => {
    const text = cell.textContent.trim().replace(/\s+/g, ' ')
    return `"${text.replace(/"/g, '""')}"`
  }).join(';')).join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pesquisas-eleitorais-${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  toast('CSV exportado')
}

function addScrollTop() {
  if (document.querySelector('.scroll-top')) return
  const btn = document.createElement('button')
  btn.className = 'scroll-top'
  btn.type = 'button'
  btn.textContent = '↑'
  btn.setAttribute('aria-label', 'Voltar ao topo')
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
  document.body.appendChild(btn)
  const update = () => btn.classList.toggle('show', window.scrollY > 500)
  window.addEventListener('scroll', update, { passive: true })
  update()
}

function mount() {
  if (mounted) return true
  if (!document.getElementById('chartPanel') || !document.getElementById('cards')) return false
  mounted = true
  injectStyle()
  addQuickTools()
  addCandidateFocus()
  addScrollTop()
  const syncTimer = setInterval(syncCandidateButtons, 800)
  window.addEventListener('beforeunload', () => clearInterval(syncTimer), { once: true })
  return true
}

const timer = setInterval(() => { if (mount()) clearInterval(timer) }, 200)
