  }).join('')
}
function renderTable() {
  const keys = state.round === 2 ? ['lula', 'flavio'] : CANDIDATES.map((c) => c.key)
  document.getElementById('thead').innerHTML = `<tr><th>Campo</th><th>Publicação</th><th>Instituto</th><th>Geo</th><th>TSE</th><th>N</th><th>Margem</th>${keys.map((k) => `<th>${CANDIDATES.find((c) => c.key === k).label}</th>`).join('')}<th>Fonte</th></tr>`
  document.getElementById('tbody').innerHTML = [...activePolls()].reverse().map((p) => {
    const cells = keys.map((k) => `<td class="num">${p.results[k] == null ? '—' : p.results[k].toLocaleString('pt-BR')}</td>`).join('')
    const link = p.sourceUrl ? `<a href="${escapeHtml(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">ver</a>` : '—'
    const published = fmtDateBR(p.published)
    const geo = escapeHtml(p.geo || 'BR')
    const tse = escapeHtml(p.tse || '—')
    return `<tr><td>${fmtDateBR(p.fieldworkStart)}–${fmtDateBR(p.fieldworkEnd)}</td><td>${published}</td><td>${escapeHtml(p.institute)}</td><td>${geo}</td><td>${tse}</td><td class="num">${p.n?.toLocaleString('pt-BR') ?? '—'}</td><td class="num">${escapeHtml(p.moeRaw || (p.moe != null ? '±' + p.moe : '—'))}</td>${cells}<td>${link}</td></tr>`
  }).join('')
}
function refresh() {
  renderLegend(); renderCards(); renderTable()
  if (state.chart) updatePollChart(state.chart, chartOpts())
  setStamp()
}
function countLabel() {
  return `${state.polls.filter((p) => p.round === 1).length} pesquisas de 1º turno · ${state.polls.filter((p) => p.round === 2).length} de 2º turno`
}
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')