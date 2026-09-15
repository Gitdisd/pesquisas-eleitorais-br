const STORAGE_KEY = 'pebr-language'
const STYLE_ID = 'pebr-site-controls-style'
const X_URL = 'https://x.com/Monkeeuphoria'

const PT = 'pt-BR'
const EN = 'en'
let currentLang = PT
let observerStarted = false
let translating = false

const T = {
  'Pesquisas eleitorais — Presidência 2026': 'Election polls — Presidency 2026',
  'Agregador neutro com pesquisas nacionais publicadas. Pontos = pesquisas individuais; linhas = média ponderada.': 'Neutral aggregator of published national polls. Dots = individual polls; lines = weighted average.',
  'Carregando…': 'Loading…', 'Atualizado em': 'Updated', 'Escuro': 'Dark', 'Claro': 'Light', 'Alternar tema': 'Toggle theme',
  'Última verificação': 'Last check', 'Próxima verificação em:': 'Next check in:', 'Verificação em andamento…': 'Check in progress…',
  'Novas pesquisas publicadas podem levar até cerca de 3 horas para aparecer (busca automática periódica).': 'Newly published polls can take up to about 3 hours to appear (periodic automatic search).',
  'Evolução da intenção de voto': 'Polling trend', 'Turno': 'Round', '1º turno': '1st round', '2º turno': '2nd round',
  '2º turno (Lula × Flávio)': '2nd round (Lula × Flávio)', 'Período': 'Period', 'tudo': 'all', 'mês': 'month', 'Janela da média': 'Average window', 'personalizado': 'custom',
  'Resetar eixos': 'Reset axes', 'Resetar Y': 'Reset Y', 'Fontes: TSE e institutos.': 'Sources: TSE and polling institutes.',
  'Zoom X/Y: roda do mouse, pinça ou Shift+arrastar.': 'X/Y zoom: mouse wheel, pinch, or Shift+drag.', 'Tabela de pesquisas': 'Poll table',
  'Site estático e sem fins partidários. Hospedagem via GitHub Pages.': 'Static site, with no party affiliation. Hosted via GitHub Pages.',
  'Painel de acompanhamento': 'Tracking dashboard', 'dados públicos': 'public data', 'Navegação rápida': 'Quick navigation', 'Navegação rápida móvel': 'Mobile quick navigation',
  'Visão geral': 'Overview', 'Gráfico': 'Chart', 'Resumo': 'Summary', 'Pesquisas': 'Polls', 'Metodologia': 'Methodology', 'Início': 'Home',
  'Visão geral do conjunto de pesquisas': 'Poll dataset overview', 'Um resumo rápido antes de entrar no gráfico e na tabela. Nada aqui altera os cálculos do site.': 'A quick overview before the chart and table. Nothing here changes the site calculations.',
  'Abrir gráfico': 'Open chart', 'Ver pesquisas': 'View polls', 'Pesquisas publicadas': 'Published polls', 'base nacional publicada': 'published national dataset',
  'Institutos': 'Institutes', 'presentes nos dados carregados': 'present in loaded data', 'Campo mais recente': 'Most recent fieldwork', 'sem data': 'no date',
  'realizado hoje': 'conducted today', 'Cobertura por turno': 'Round coverage', '1º turno · 2º turno': '1st round · 2nd round', 'focar': 'focus', 'tela cheia': 'fullscreen',
  'Filtros por instituto': 'Institute filters', 'Filtros por instituto · aberto': 'Institute filters · open', 'Use os chips para incluir ou excluir institutos do gráfico e do resumo.': 'Use the chips to include or exclude institutes from the chart and summary.',
  'média selecionada': 'selected average', 'Tendência recente de': 'Recent trend for', 'Filtrar instituto ou campo…': 'Filter institute or field…', 'Filtrar tabela de pesquisas': 'Filter poll table',
  'linhas': 'rows', 'Como usar:': 'How to use:', 'selecione o turno, ajuste a janela da média e toque em um ponto do gráfico para ler instituto, amostra e margem de erro. Os filtros por instituto afetam o gráfico e o resumo.': 'select the round, adjust the average window, and tap a chart point to see the institute, sample and margin of error. Institute filters affect the chart and summary.',
  'Linhas do gráfico': 'Chart lines', 'Mostrar ou ocultar': 'Show or hide', 'Compartilhar': 'Share', 'Exportar tabela CSV': 'Export table CSV', 'Focar gráfico': 'Focus chart',
  'Restaurar visualização': 'Restore view', 'Visualização restaurada': 'View restored', 'Link copiado': 'Link copied', 'Compartilhamento não disponível neste navegador': 'Sharing is not available in this browser',
  'Não foi possível compartilhar': 'Could not share', 'CSV exportado': 'CSV exported', 'Voltar ao topo': 'Back to top', 'Não foi possível carregar as pesquisas:': 'Could not load polls:',
  'Atualização automática falhou:': 'Automatic update failed:', 'O desenho': 'The design', 'Bolinha': 'Dot', 'Linha cheia': 'Solid line', 'Linha tracejada': 'Dashed line',
  'Linhas extras (overlays)': 'Extra lines (overlays)', 'Por que não olhamos só uma pesquisa': 'Why we do not look at only one poll', 'Os modos da linha (Modelos 1 a 5)': 'Line modes (Models 1 to 5)',
  'Réguas (overlays / indicadores)': 'Guides (overlays / indicators)', 'Escalas e botões do gráfico': 'Chart scales and controls', 'Ferramentas da página': 'Page tools',
  'O que o site não faz': 'What the site does not do', 'Contas diretas (para quem quiser o detalhe)': 'Direct formulas (for the details)', 'Site estático, sem fins partidários.': 'Static site, with no party affiliation.',
  'off': 'off', '1 — padrão': '1 — standard', '2 — casa justa': '2 — fair house', '3 — quando brigam': '3 — when they disagree', '4 — filme, não foto': '4 — film, not a snapshot', '5 — nervoso': '5 — reactive',
  'Exemplo:': 'Example:', 'Tema / bandeira': 'Theme / flag', 'Verificar agora': 'Check now', 'Tabela': 'Table',
  'Não diz “vai ganhar”. Diz “as pesquisas de agora, juntas, estão aqui”.': 'It does not say “will win.” It says “the current polls, together, are here.”',
  'Não inventa pesquisa. Sem número publicado, não tem bolinha.': 'It does not invent polls. Without a published number, there is no dot.',
  'Não usa pesquisa de um só estado no desenho nacional.': 'It does not use a single-state poll in the national view.', 'Não transforma 1º turno em 2º turno por mágica.': 'It does not turn a 1st-round poll into a 2nd-round poll by magic.'
}

const DIRECT_T = {
  ' = uma pesquisa. É só aquela escola, naquele dia.': ' = one poll. It is just that pollster, on that day.', ' = o resumo de várias bolinhas. É o número do site.': ' = the summary of many dots. It is the site number.',
  ' = “se continuar assim”. Não é o resultado da eleição.': ' = “if this continues”. It is not the election result.', ' = réguas em cima do resumo. Elas não mudam o número dos cartões.': ' = guides placed over the summary. They do not change the card numbers.',
  'Um amigo sempre mede um pouco alto. Outro sempre mede um pouco baixo.': 'One pollster is always a little high. Another is always a little low.', 'Quem ouviu mais pessoas (N grande) pesa mais, mas não manda sozinho.': 'A poll that interviewed more people (large N) gets more weight, but never decides alone.',
  'Medida velha vale menos que medida nova.': 'Older measurements count less than newer ones.', 'Se o mesmo amigo manda três recados na mesma semana, cada recado vale menos — senão ele grita mais alto só porque falou três vezes.': 'If the same pollster sends three reports in one week, each report counts less — otherwise it would speak louder simply because it spoke three times.',
  'É a mesma turma de bolinhas. Muda só o jeito de fazer a média. Um modo de cada vez.': 'It is the same set of dots. Only the averaging method changes. One mode at a time.', 'Bolinha + linha antiga. Sem “se continuar assim”.': 'Dot + the original line. No “if this continues”.',
  'Receita antiga do site. Pesquisa grande e nova pesa mais. Não corrige o hábito da casa.': 'The site’s original formula. Large and recent polls weigh more. It does not correct for house bias.', 'Se uma casa sempre fica 2 pontos acima das outras, a gente tira esses 2 antes de misturar.': 'If one house is always 2 points above the others, we subtract those 2 before combining.',
  'Olha a margem de erro e o quanto as casas discordam. Se discordam muito, ninguém manda sozinho.': 'It looks at the margin of error and how much pollsters disagree. When they disagree a lot, nobody dominates alone.', 'A disputa anda um pouquinho por dia. Cada pesquisa nova empurra o filme, não apaga o capítulo anterior.': 'The contest moves a little each day. Each new poll nudges the film forward; it does not erase the previous chapter.',
  'Olha quase só o que acabou de sair. Bom para ver o susto. Ruim para um número calmo.': 'It looks mostly at what was just released. Good for seeing a shock; bad for a calm number.', 'São adesivos no desenho. Ligar ou desligar não muda os cartões.': 'These are overlays on the drawing. Turning them on or off does not change the cards.',
  'São duas perguntas diferentes. Não misturamos as bolinhas.': 'These are two different questions. We do not mix the dots.', 'Ligando ou desligando': 'Turning on or off', 'só cor da página. Zero efeito no número.': 'only changes the page color. Zero effect on the numbers.',
  'pede de novo o arquivo que já está no ar. Não sai caçando pesquisa nova na hora.': 'requests the file already online again. It does not hunt for a new poll immediately.', 'lista crua: quem mediu, quantas pessoas, margem, link.': 'raw list: who polled, sample size, margin, link.'
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .site-controls{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-top:.8rem}
    .lang-switch{display:inline-flex;align-items:center;gap:.2rem;padding:.2rem;border:1px solid var(--border);border-radius:999px;background:var(--glass);backdrop-filter:blur(10px)}
    .lang-switch button{border:0;background:transparent;color:var(--muted);font:inherit;font-size:.75rem;font-weight:800;min-height:32px;padding:.3rem .65rem;border-radius:999px;cursor:pointer}
    .lang-switch button.active{background:var(--text);color:var(--surface)}
    .x-follow{display:inline-flex;align-items:center;gap:.5rem;min-height:38px;padding:.45rem .8rem;border-radius:999px;border:1px solid var(--border);background:#000;color:#fff;text-decoration:none;font:inherit;font-size:.78rem;font-weight:800;box-shadow:0 4px 16px rgba(0,0,0,.16)}
    .x-follow:hover,.x-follow:focus-visible{transform:translateY(-1px);box-shadow:0 7px 22px rgba(0,0,0,.22);outline:none}
    .x-mark{font-size:1rem;line-height:1}
    html[data-theme=light] .x-follow{background:#000;color:#fff}
    @media(max-width:700px){.site-controls{width:100%}.lang-switch{order:2}.x-follow{order:1}.hdr-row{align-items:flex-start!important}.site-controls{justify-content:flex-start}}
  `
  document.head.appendChild(style)
}

function keyFor(text) { return text.trim().replace(/\s+/g, ' ') }
function preserveEdges(original, replacement) { const left=(original.match(/^\s*/) || [''])[0]; const right=(original.match(/\s*$/) || [''])[0]; return `${left}${replacement}${right}` }
function translateText(text, lang) {
  const normalized=keyFor(text); const source=lang===EN ? T[normalized] || DIRECT_T[normalized] : null
  if(source) return preserveEdges(text,source)
  if(lang===PT){ const hit=Object.entries(T).find(([,v])=>v===normalized)?.[0] || Object.entries(DIRECT_T).find(([,v])=>v===normalized)?.[0]; if(hit) return preserveEdges(text,hit) }
  return translateDynamic(text,lang)
}
function translateDynamic(text,lang){
  if(lang===EN) return text.replace(/^Atualizado em\s*/i,'Updated ').replace(/^Última verificação:\s*/i,'Last check: ').replace(/^Próxima verificação em:\s*/i,'Next check in: ').replace(/^há menos de 1 min$/i,'less than 1 min ago').replace(/^há (\d+) min$/i,'$1 min ago').replace(/^há 1 h$/i,'1 hr ago').replace(/^há (\d+) h$/i,'$1 hrs ago').replace(/^há (\d+) h e (\d+) min$/i,'$1 hrs $2 min ago').replace(/^há 1 dia$/i,'1 day ago').replace(/^há (\d+) dias$/i,'$1 days ago').replace(/^(\d[\d.,]*) linhas$/i,'$1 rows').replace(/^média selecionada$/i,'selected average')
  return text.replace(/^Updated\s*/i,'Atualizado em ').replace(/^Last check:\s*/i,'Última verificação: ').replace(/^Next check in:\s*/i,'Próxima verificação em: ').replace(/^less than 1 min ago$/i,'há menos de 1 min').replace(/^(\d+) min ago$/i,'há $1 min').replace(/^1 hr ago$/i,'há 1 h').replace(/^(\d+) hrs ago$/i,'há $1 h').replace(/^(\d+) hrs (\d+) min ago$/i,'há $1 h e $2 min').replace(/^1 day ago$/i,'há 1 dia').replace(/^(\d+) days ago$/i,'há $1 dias').replace(/^(\d+) rows$/i,'$1 linhas').replace(/^selected average$/i,'média selecionada')
}

function translateTree(lang){
  if(translating)return; translating=true; const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); const nodes=[]
  while(walker.nextNode()){const node=walker.currentNode;if(node.parentElement?.closest('.x-follow,.lang-switch,script,style'))continue;nodes.push(node)}
  for(const node of nodes){const next=translateText(node.nodeValue,lang);if(next!==node.nodeValue)node.nodeValue=next} translating=false
}
function addControls(){
  const header=document.querySelector('.hdr-row'); const text=document.querySelector('.hdr-text'); if(!header||!text||document.querySelector('.site-controls'))return
  const controls=document.createElement('div'); controls.className='site-controls'; controls.innerHTML=`<div class="lang-switch" role="group" aria-label="Language / Idioma"><button type="button" data-lang="pt-BR">Português</button><button type="button" data-lang="en">English</button></div><a class="x-follow" href="${X_URL}" target="_blank" rel="noopener noreferrer" aria-label="Follow @Monkeeuphoria on X"><span class="x-mark">𝕏</span><span data-x-label>Follow</span></a>`
  header.appendChild(controls); controls.querySelectorAll('[data-lang]').forEach(btn=>btn.addEventListener('click',()=>setLanguage(btn.dataset.lang))); updateLangButtons()
}
function updateLangButtons(){
  document.querySelectorAll('.lang-switch [data-lang]').forEach(btn=>{const active=btn.dataset.lang===currentLang;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))})
  const x=document.querySelector('[data-x-label]'); if(x)x.textContent=currentLang===EN?'Follow':'Seguir'
}
function setLanguage(lang){
  currentLang=lang===EN?EN:PT; localStorage.setItem(STORAGE_KEY,currentLang); document.documentElement.lang=currentLang; document.title=currentLang===EN?'Election Polls BR — 2026':'Pesquisas Eleitorais BR — 2026'
  const meta=document.querySelector('meta[name="description"]'); if(meta)meta.content=currentLang===EN?'Neutral aggregator of published Brazilian presidential election polls — 2026.':'Agregador neutro de pesquisas eleitorais presidenciais do Brasil — 2026.'
  translateTree(currentLang); updateLangButtons(); window.dispatchEvent(new CustomEvent('pebr-language-change',{detail:{lang:currentLang}}))
}
function watchDom(){
  if(observerStarted)return; observerStarted=true; const observer=new MutationObserver(mutations=>{if(translating||currentLang===PT)return;const hasAdded=mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===Node.ELEMENT_NODE||n.nodeType===Node.TEXT_NODE));if(hasAdded)requestAnimationFrame(()=>translateTree(currentLang))}); observer.observe(document.body,{childList:true,subtree:true})
}
function mount(){const app=document.getElementById('app');if(!app||!document.querySelector('.hdr-row'))return false;injectStyle();addControls();watchDom();const saved=localStorage.getItem(STORAGE_KEY);currentLang=saved===EN?EN:PT;setLanguage(currentLang);return true}
const timer=setInterval(()=>{if(mount())clearInterval(timer)},200)
