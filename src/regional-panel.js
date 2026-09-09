import { CANDIDATES, matchCandidate, parseMoe, isFirstRound, isSecondRound } from './candidates.js'
import { createPollChart, updatePollChart } from './chart.js'

const BASE = import.meta.env.BASE_URL
const NAT_URL = `${BASE}data/polls.json`
const REG_URL = `${BASE}data/polls-regional.json`

const state = {
  polls: [],
  round: 1,
  geos: new Set(['BR', 'SP', 'MG']),
  chart: null,
}

function normalize(rows) {
  return rows
    .map((row, idx) => {
      const scenario = row.scenario || ''
      let round = null
      if (isSecondRound(scenario) && /lula/i.test(scenario) && /fl[áa]vio/i.test(scenario)) round = 2
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
      const end = row.fieldwork_end || row.published_date
      if (!end) return null
      return {
        id: `reg-${row.institute}-${end}-${round}-${idx}`,
        institute: row.institute,
        published: row.published_date,
        fieldworkEnd: end,
        t: Date.parse(end + 'T12:00:00Z'),
        n: row.n,
        moe: parseMoe(row.margin_of_error),
        geo: row.geo || 'BR',
        scenario,
        round,
        results,
        sourceUrl: row.source_url,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t)
}

function filtered() {
  return state.polls.filter((p) => state.geos.has(p.geo || 'BR'))
}

function chartOpts() {
  return {
    polls: filtered(),
    round: state.round,
    institutes: new Set(),
    windowDays: 14,
    rangeDays: null,
    projection: false,
  }
}

function renderTable() {
  const keys = state.round === 2 ? CANDIDATES.filter((c) => c.key === 'lula' || c.key === 'flavio') : CANDIDATES
  const thead = document.getElementById('regThead')
  const tbody = document.getElementById('regTbody')
  if (!thead || !tbody) return
  thead.innerHTML = `<tr><th>Campo</th><th>Instituto</th><th>Geo</th><th>N</th>${keys.map((c) => `<th>${c.label}</th>`).join('')}</tr>`
  const rows = filtered().filter((p) => p.round === state.round).slice().reverse()
  tbody.innerHTML = rows
    .map((p) => {
      const cells = keys.map((c) => {
        const v = p.results[c.key]
        return `<td class="num">${v == null ? '—' : String(v).replace('.', ',')}</td>`
      }).join('')
      return `<tr><td>${p.fieldworkEnd}</td><td>${p.institute}</td><td>${p.geo}</td><td class="num">${p.n?.toLocaleString('pt-BR') ?? '—'}</td>${cells}</tr>`
    })
    .join('')
}

function refresh() {
  if (state.chart) updatePollChart(state.chart, chartOpts())
  renderTable()
}

function mount() {
  if (document.getElementById('allSourcesPanel')) return
  const stack = document.querySelector('main.wrap') || document.getElementById('app')
  if (!stack) return

  const panel = document.createElement('section')
  panel.className = 'panel chart-panel'
  panel.id = 'allSourcesPanel'
  panel.innerHTML = `
    <p class="chapter-kicker">Capítulo 2</p>
    <h2 class="chart-title">Todas as fontes (nacional + SP + MG)</h2>
    <p class="hint">Separado do agregado nacional. Inclui estaduais de <strong>São Paulo</strong> e <strong>Minas Gerais</strong>. A média daqui não é o Brasil — estado ≠ país. GERP, Ideia e Palver de 9/9 entram neste bloco.</p>
    <div class="controls controls-primary">
      <div class="seg" role="group" aria-label="Turno com SP e MG">
        <button type="button" data-reg-round="1" class="active">1º com SP/MG</button>
        <button type="button" data-reg-round="2">2º com SP/MG</button>
      </div>
      <div class="filters institutes-inline" id="geoChips"></div>
    </div>
    <div class="chart-box"><canvas id="allSourcesChart" aria-label="Gráfico todas as fontes"></canvas></div>
    <h3 class="chart-title" style="margin-top:.85rem">Tabela — todas as fontes</h3>
    <div class="table-wrap"><table class="polls"><thead id="regThead"></thead><tbody id="regTbody"></tbody></table></div>
  `

  const metodo = stack.querySelector('.metodologia')
  const nationalTable = document.getElementById('nationalTablePanel')
  if (metodo) stack.insertBefore(panel, metodo)
  else if (nationalTable) nationalTable.after(panel)
  else stack.appendChild(panel)

  const geos = [...new Set(state.polls.map((p) => p.geo || 'BR'))].sort()
  const chips = document.getElementById('geoChips')
  chips.innerHTML = geos.map((g) => {
    const on = state.geos.has(g) ? ' on' : ''
    const label = g === 'BR' ? 'Nacional' : g
    return `<button type="button" class="chip${on}" data-geo="${g}">${label}</button>`
  }).join('')

  chips.querySelectorAll('[data-geo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.geo
      if (state.geos.has(g)) state.geos.delete(g)
      else state.geos.add(g)
      if (state.geos.size === 0) state.geos.add('BR')
      chips.querySelectorAll('[data-geo]').forEach((b) => b.classList.toggle('on', state.geos.has(b.dataset.geo)))
      refresh()
    })
  })

  panel.querySelectorAll('[data-reg-round]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.round = Number(btn.dataset.regRound)
      panel.querySelectorAll('[data-reg-round]').forEach((b) => b.classList.toggle('active', b === btn))
      refresh()
    })
  })

  const canvas = document.getElementById('allSourcesChart')
  state.chart = createPollChart(canvas, chartOpts())
  renderTable()
}

async function bootRegional() {
  try {
    const [natRes, regRes] = await Promise.all([
      fetch(NAT_URL + '?t=' + Date.now(), { cache: 'no-store' }),
      fetch(REG_URL + '?t=' + Date.now(), { cache: 'no-store' }),
    ])
    const nat = natRes.ok ? await natRes.json() : []
    const extra = regRes.ok ? await regRes.json() : []
    const natRows = (Array.isArray(nat) ? nat : nat.polls || []).map((p) => ({ ...p, geo: p.geo || 'BR' }))
    state.polls = normalize([...natRows, ...extra])
    const started = Date.now()
    const wait = setInterval(() => {
      if (document.getElementById('chartPanel') || Date.now() - started > 8000) {
        clearInterval(wait)
        mount()
      }
    }, 150)
  } catch (err) {
    console.warn('regional panel failed', err)
  }
}

bootRegional()
