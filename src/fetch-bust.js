const orig = window.fetch.bind(window)

window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || String(input)
  if (/\/polls\.json(\?|$)/.test(url) && !/polls-extra\.json/.test(url) && !/polls-regional\.json/.test(url)) {
    const next = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()
    const extraUrl = url.replace(/polls\.json.*/, 'polls-extra.json?t=' + Date.now())
    return Promise.all([
      orig(next, { ...init, cache: 'no-store' }),
      orig(extraUrl, { cache: 'no-store' }).catch(() => null),
    ]).then(async ([res, extraRes]) => {
      if (!res.ok) return res
      const data = await res.clone().json()
      const base = Array.isArray(data) ? data : data.polls || []
      let more = []
      if (extraRes && extraRes.ok) {
        const extra = await extraRes.json()
        more = Array.isArray(extra) ? extra : extra.polls || []
      }
      const body = JSON.stringify([...more, ...base])
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
  }
  if (/\/meta\.json(\?|$)/.test(url)) {
    const next = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()
    return orig(next, { ...init, cache: 'no-store' })
  }
  return orig(input, init)
}
