const X_URL = 'https://x.com/Monkeeuphoria'
const X_HANDLE = '@Monkeeuphoria'
const X_PFP = 'https://unavatar.io/x/Monkeeuphoria'

const T = {
  'Visão geral': 'Overview', 'Gráfico': 'Chart', 'Resumo': 'Summary', 'Pesquisas': 'Polls', 'Metodologia': 'Methodology',
  'Início': 'Home', 'Painel de acompanhamento': 'Research dashboard', 'dados públicos': 'public data',
  'Abrir gráfico': 'Open chart', 'Ver pesquisas': 'View polls', 'Filtros por instituto': 'Pollster filters',
  'Use os chips para incluir ou excluir institutos do gráfico e do resumo.': 'Use the chips to include or exclude pollsters from the chart and summary.',
  'média selecionada': 'selected average', 'Como usar:': 'How to use:', 'tela cheia': 'fullscreen', 'focar': 'focus',
  'Filtrar instituto ou campo…': 'Filter pollster or fieldwork…', 'linhas do gráfico': 'chart lines',
  'Restaurar visualização': 'Reset view', 'Exportar tabela CSV': 'Export table CSV', 'Compartilhar': 'Share',
  'Pesquisas publicadas': 'Published polls', 'Institutos': 'Pollsters', 'Campo mais recente': 'Latest fieldwork',
  'Cobertura por turno': 'Coverage by round', 'base nacional publicada': 'published national dataset',
  'presentes nos dados carregados': 'present in loaded data', 'sem data': 'no date', 'realizado hoje': 'today',
  '1º turno': '1st round', '2º turno': '2nd round', 'linhas': 'rows', 'Temas': 'Themes'
}
const DIRECT_T = {
  'Visão geral do conjunto de pesquisas': 'Overview of the polling dataset',
  'Um resumo rápido antes de entrar no gráfico e na tabela. Nada aqui altera os cálculos do site.': 'A quick summary before the chart and table. Nothing here changes the site calculations.',
  'Um resumo rápido antes de entrar no gráfico e na tabela.': 'A quick summary before the chart and table.',
  'selecione o turno, ajuste a janela da média e toque em um ponto do gráfico para ler instituto, amostra e margem de erro. Os filtros por instituto afetam o gráfico e o resumo.': 'select the round, adjust the averaging window, and tap a chart point to see pollster, sample size, and margin of error. Pollster filters affect the chart and summary.'
}

let language = localStorage.getItem('pebr-language') === 'en' ? 'en' : 'pt-BR'
let translating = false

function translateText(text, toEnglish) {
  if (DIRECT_T[text]) return toEnglish ? DIRECT_T[text] : text
  if (toEnglish && T[text]) return T[text]
  if (!toEnglish) {
    const reverse = Object.entries(T).find(([, en]) => en === text)
    if (reverse) return reverse[0]
  }
  return text
}

function translateTree(root, toEnglish) {
  if (translating) return
  translating = true
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    for (const node of nodes) {
      if (!node.nodeValue.trim()) continue
      let text = node.nodeValue
      const exact = translateText(text.trim(), toEnglish)
      if (exact !== text.trim()) node.nodeValue = text.replace(text.trim(), exact)
      for (const [pt, en] of Object.entries(T)) {
        if (pt.length < 4) continue
        const replacement = toEnglish ? en : pt
        const source = toEnglish ? pt : en
        if (node.nodeValue.includes(source)) node.nodeValue = node.nodeValue.split(source).join(replacement)
      }
    }
  } finally { translating = false }
}

function updateLangButtons() {
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === language)
    button.setAttribute('aria-pressed', String(button.dataset.lang === language))
  })
  const label = document.querySelector('[data-x-label]')
  if (label) label.textContent = language === 'en' ? 'Follow' : 'Seguir'
  const x = document.querySelector('.x-follow')
  if (x) x.setAttribute('aria-label', language === 'en' ? 'Follow @Monkeeuphoria on X' : 'Seguir @Monkeeuphoria no X')
}

function setLanguage(next) {
  language = next === 'en' ? 'en' : 'pt-BR'
  localStorage.setItem('pebr-language', language)
  document.documentElement.lang = language
  document.title = language === 'en' ? 'Brazilian Electoral Polls — 2026' : 'Pesquisas Eleitorais BR — 2026'
  const desc = document.querySelector('meta[name="description"]')
  if (desc) desc.content = language === 'en' ? 'Brazilian electoral polling data, methodology, charts and historical results.' : 'Dados de pesquisas eleitorais brasileiras, metodologia, gráficos e resultados históricos.'
  translateTree(document.body, language === 'en')
  updateLangButtons()
  document.dispatchEvent(new CustomEvent('pebr-language-change', { detail: { language } }))
}

function addControls() {
  if (document.querySelector('.site-controls')) return true
  const host = document.querySelector('.app-hdr .hdr-text') || document.querySelector('.app-hdr .wrap') || document.querySelector('.app-hdr')
  if (!host) return false
  const controls = document.createElement('div')
  controls.className = 'site-controls'
  controls.innerHTML = `
    <div class="lang-switch" role="group" aria-label="Language / Idioma">
      <button type="button" data-lang="pt-BR">Português</button>
      <button type="button" data-lang="en">English</button>
    </div>
    <a class="x-follow" href="${X_URL}" target="_blank" rel="noopener noreferrer">
      <span class="x-profile-row"><img class="x-pfp" src="${X_PFP}" alt=""><span class="x-handle">${X_HANDLE}</span></span>
      <span data-x-label>Seguir</span>
    </a>`

  const anchor = host.querySelector('.stamp') || host.querySelector('p')
  if (anchor) host.insertBefore(controls, anchor)
  else host.appendChild(controls)

  controls.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.lang)))
  updateLangButtons()
  return true
}

function installStyles() {
  if (document.getElementById('site-controls-style')) return
  const style = document.createElement('style')
  style.id = 'site-controls-style'
  style.textContent = `
.site-controls{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;width:100%;margin:.65rem 0 .15rem}.lang-switch{display:flex;gap:2px;padding:3px;border:1px solid var(--border,#d9dee7);border-radius:999px;background:var(--panel,#fff)}.lang-switch button{border:0;background:transparent;border-radius:999px;padding:7px 11px;font:inherit;font-weight:700;cursor:pointer}.lang-switch button.active{background:var(--accent,#2563eb);color:#fff}.x-follow{width:235px;height:50px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:3px 12px;border-radius:999px;background:#000;color:#fff;text-decoration:none;font-weight:800;line-height:1;box-shadow:0 2px 8px #0002;transition:transform .15s ease,box-shadow .15s ease}.x-follow:hover{transform:translateY(-1px);box-shadow:0 5px 14px #0003}.x-profile-row{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;height:24px;white-space:nowrap;line-height:1}.x-pfp{width:23px;height:23px;flex:0 0 23px;border-radius:50%;object-fit:cover;background:#333}.x-handle{display:block;white-space:nowrap;overflow:visible;font-size:.84rem;letter-spacing:-.015em}.x-follow [data-x-label]{display:block;width:100%;text-align:center;font-size:.86rem;line-height:1;margin:0}.x-follow:focus-visible,.lang-switch button:focus-visible{outline:2px solid var(--accent,#2563eb);outline-offset:2px}@media(max-width:700px){.site-controls{width:100%;margin:.45rem 0}.x-follow{width:235px;max-width:100%}.lang-switch{flex:none}}
`
  document.head.appendChild(style)
}

function boot() {
  installStyles()
  if (!addControls()) { requestAnimationFrame(boot); return }
  document.documentElement.lang = language
  if (language === 'en') translateTree(document.body, true)
  updateLangButtons()
  const observer = new MutationObserver((mutations) => {
    if (translating || language !== 'en') return
    const added = mutations.some((m) => [...m.addedNodes].some((n) => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim())))
    if (added) translateTree(document.body, true)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
else boot()
