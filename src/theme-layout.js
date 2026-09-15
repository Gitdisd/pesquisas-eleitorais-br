import './party-themes.css'

const PARTY_THEMES = [
  ['party-pt', 'PT'],
  ['party-pl', 'PL'],
  ['party-missao', 'Missão'],
  ['party-psd', 'PSD'],
  ['party-novo', 'Novo'],
  ['party-avante', 'Avante'],
]
const PARTY_THEME_KEY = 'pebr-party-theme'

function setSelectedTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  if (theme.startsWith('party-')) localStorage.setItem(PARTY_THEME_KEY, theme)
  else localStorage.removeItem(PARTY_THEME_KEY)
  document.querySelectorAll('[data-party-theme]').forEach((button) => {
    button.classList.toggle('on', button.dataset.partyTheme === theme)
    button.setAttribute('aria-pressed', String(button.dataset.partyTheme === theme))
  })
  document.dispatchEvent(new CustomEvent('pebr-theme-change', { detail: { theme } }))
}

function arrangeThemeControls() {
  const themeToggle = document.getElementById('themeToggle')
  const hdrText = document.querySelector('.app-hdr .hdr-text')
  if (!themeToggle || !hdrText) return false
  if (document.getElementById('themeBox')) return true

  const box = document.createElement('div')
  box.id = 'themeBox'
  box.className = 'theme-box'
  box.innerHTML = `
    <div class="theme-box-label">Temas</div>
    <div class="theme-box-row">
      <div class="theme-basic"><span class="theme-basic-label">Padrão</span></div>
      <div class="party-themes" id="partyThemes" role="group" aria-label="Temas de partidos">
        ${PARTY_THEMES.map(([id, label]) => `<button type="button" class="chip" data-party-theme="${id}" aria-pressed="false">${label}</button>`).join('')}
      </div>
    </div>`

  box.querySelector('.theme-basic').appendChild(themeToggle)
  themeToggle.classList.add('theme-cycle-button')
  hdrText.appendChild(box)

  box.querySelectorAll('[data-party-theme]').forEach((button) => {
    button.addEventListener('click', () => setSelectedTheme(button.dataset.partyTheme))
  })

  const savedParty = localStorage.getItem(PARTY_THEME_KEY)
  if (PARTY_THEMES.some(([id]) => id === savedParty)) setSelectedTheme(savedParty)
  else document.querySelectorAll('[data-party-theme]').forEach((button) => button.setAttribute('aria-pressed', 'false'))

  const style = document.createElement('style')
  style.id = 'theme-layout-style'
  style.textContent = `
.theme-box{margin:.75rem 0 0;padding:.7rem .8rem;border:1px solid var(--border);border-radius:12px;background:var(--chip-bg);box-shadow:var(--shadow);width:100%}.theme-box-label{display:block;margin:0 0 .5rem;font-size:.78rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}.theme-box-row{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap}.theme-basic{display:flex;align-items:center;gap:.45rem;flex:0 0 auto}.theme-basic-label{font-size:.78rem;color:var(--muted);font-weight:700}.theme-cycle-button{min-height:40px;flex:0 0 auto}.party-themes{display:flex;flex:1;flex-wrap:wrap;align-items:center;gap:.35rem;margin:0}.party-themes .chip{min-height:40px;font-size:.76rem}.party-themes .chip.on{background:var(--chip-on-bg);border-color:var(--chip-on-border);color:var(--chip-on-text);font-weight:800;outline:2px solid var(--accent)}@media(max-width:600px){.theme-box{margin-top:.55rem;padding:.6rem}.theme-box-row{align-items:stretch}.theme-basic{width:100%}.theme-cycle-button{flex:1}.party-themes{width:100%}.party-themes .chip{flex:1 1 auto;min-height:40px}}
`
  document.head.appendChild(style)
  return true
}

const started = Date.now()
const timer = setInterval(() => {
  if (arrangeThemeControls() || Date.now() - started > 15000) clearInterval(timer)
}, 100)
