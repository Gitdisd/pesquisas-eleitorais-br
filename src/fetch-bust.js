const orig = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || String(input)
  if (/\/(polls|meta)\.json(\?|$)/.test(url)) {
    const next = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()
    return orig(next, { ...init, cache: 'no-store' })
  }
  return orig(input, init)
}
