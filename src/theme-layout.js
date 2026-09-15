function arrangeThemeControls() {
  const partyRow = document.getElementById('partyThemes')
  const themeToggle = document.getElementById('themeToggle')
  if (!partyRow || !themeToggle) return false
  if (document.getElementById('themeBox')) return true

  const box = document.createElement('div')
  box.id = 'themeBox'
  box.className = 'theme-box'

  const label = document.createElement('span')
  label.className = 'theme-box-label'
  label.textContent = 'Temas'
  label.setAttribute('aria-label', 'Temas')

  const row = document.createElement('div')
  row.className = 'theme-box-row'

  themeToggle.classList.add('theme-cycle-button')
  row.appendChild(themeToggle)
  row.appendChild(partyRow)
  box.append(label, row)

  const host = partyRow.parentElement
  host.appendChild(box)

  const style = document.createElement('style')
  style.id = 'theme-layout-style'
  style.textContent = `
.theme-box{margin:.75rem 0 0;padding:.7rem .8rem;border:1px solid var(--border);border-radius:12px;background:var(--chip-bg);box-shadow:var(--shadow);width:100%}.theme-box-label{display:block;margin:0 0 .45rem;font-size:.78rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}.theme-box-row{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap}.theme-cycle-button{flex:0 0 auto}.theme-box .party-themes{margin:0;display:flex;flex:1;gap:.35rem;align-items:center}.theme-box .party-themes .chip{min-height:40px}.theme-box .theme-toggle{min-height:40px}@media(max-width:600px){.theme-box{margin-top:.55rem;padding:.6rem}.theme-box-row{align-items:stretch}.theme-cycle-button{width:100%}.theme-box .party-themes{width:100%}.theme-box .party-themes .chip{flex:1 1 auto}}
`
  document.head.appendChild(style)
  return true
}

const started = Date.now()
const timer = setInterval(() => {
  if (arrangeThemeControls() || Date.now() - started > 15000) clearInterval(timer)
}, 100)
