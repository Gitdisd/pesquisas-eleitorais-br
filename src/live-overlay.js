function injectVerifyButton() {
  if (document.getElementById('verifyNow')) return true
  const timer = document.getElementById('checkTimer')
  if (!timer) return false

  const wrap = document.createElement('div')
  wrap.className = 'hdr-actions'
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.55rem'

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
  link.textContent = 'Disparar busca no GitHub'
  link.style.cssText = 'text-decoration:none;display:inline-flex;align-items:center'

  const toast = document.createElement('p')
  toast.id = 'verifyToast'
  toast.className = 'refresh-notice'
  toast.textContent =
    'Verificar agora recarrega o JSON publicado. A busca de matérias novas roda no GitHub Actions (~1 h).'

  wrap.append(btn, link)
  timer.after(wrap)
  wrap.after(toast)

  btn.addEventListener('click', async () => {
    btn.disabled = true
    toast.textContent = 'Recarregando polls.json publicado…'
    try {
      const t = Date.now()
      const [pollRes, metaRes] = await Promise.all([
        fetch(`data/polls.json?t=${t}`, { cache: 'no-store' }),
        fetch(`data/meta.json?t=${t}`, { cache: 'no-store' }),
      ])
      if (!pollRes.ok) throw new Error('HTTP ' + pollRes.status)
      const polls = await pollRes.json()
      const meta = metaRes.ok ? await metaRes.json() : null
      const n = Array.isArray(polls) ? polls.length : polls.polls?.length || 0
      toast.textContent = meta?.content_hash
        ? `${n} registros no arquivo publicado. Recarregando gráfico e tabela…`
        : `${n} registros. Recarregando…`
      window.location.reload()
    } catch (err) {
      toast.textContent = 'Falha ao recarregar: ' + err.message
      btn.disabled = false
    }
  })
  return true
}

function addTseHeaderIfMissing() {
  const ths = [...document.querySelectorAll('table.polls thead th')].map((th) => th.textContent.trim())
  if (!ths.length || ths.includes('TSE')) return
  const inst = [...document.querySelectorAll('table.polls thead th')].find((th) => th.textContent.trim() === 'Instituto')
  if (!inst) return
  const th = document.createElement('th')
  th.textContent = 'TSE'
  inst.after(th)
  document.querySelectorAll('table.polls tbody tr').forEach((tr) => {
    const td = document.createElement('td')
    td.textContent = '—'
    tr.children[1]?.after(td)
  })
}

const started = Date.now()
const id = setInterval(() => {
  const ok = injectVerifyButton()
  if (ok) addTseHeaderIfMissing()
  if (ok || Date.now() - started > 15000) clearInterval(id)
}, 200)
