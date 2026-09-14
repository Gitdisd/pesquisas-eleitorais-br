const SOCIAL_HOSTS = /(?:whatsapp\.com|facebook\.com|twitter\.com|x\.com|t\.me|instagram\.com|linkedin\.com)/i
const TRACKING_KEYS = new Set(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ref','referrer'])
const EXCLUDED_PATHS = /(?:\/tag\/|\/tags\/|\/autor\/|\/author\/|\/categoria\/|\/category\/|\/search\/|\/busca\/|\/feed\/?$|\/rss\/?$|\/politica\/?$|\/eleicoes\/?$)/i
const NON_PRESIDENTIAL = /(?:governador|governadora|prefeito|prefeita|senado|senador|senadora|deputad[oa]|vereador|vereadora|assembleia|estadual|municipal|capital)/i
const PRESIDENTIAL_SIGNAL = /(?:president(?:e|ial)|presidência|presidencia|primeiro[-_ ]turno|1[ºo°]?[-_ ]?turno|segundo[-_ ]turno|2[ºo°]?[-_ ]?turno|intenção[-_ ]de[-_ ]voto|intencao[-_ ]de[-_ ]voto|pesquisa[-_ ]eleitoral)/i

export function canonicalizeUrl(raw) {
  try {
    const u = new URL(raw)
    u.hash = ''
    for (const key of [...u.searchParams.keys()]) {
      const lower = key.toLowerCase()
      if (TRACKING_KEYS.has(lower) || lower.startsWith('utm_')) u.searchParams.delete(key)
    }
    return u.toString()
  } catch {
    return raw
  }
}

export function classifyPollLink(url, title = '') {
  const canonical = canonicalizeUrl(url)
  const hay = `${canonical} ${title}`.toLowerCase()
  let score = 0
  const reasons = []
  let rejected = false
  try {
    const host = new URL(canonical).hostname
    if (SOCIAL_HOSTS.test(host)) { rejected = true; reasons.push('social') }
  } catch {}
  if (EXCLUDED_PATHS.test(hay)) { rejected = true; reasons.push('generic-route') }
  if (NON_PRESIDENTIAL.test(hay) && !PRESIDENTIAL_SIGNAL.test(hay)) { rejected = true; reasons.push('wrong-office') }
  if (PRESIDENTIAL_SIGNAL.test(hay)) { score += 40; reasons.push('presidential-signal') }
  if (/(?:datafolha|quaest|atlasintel|poderdata|nexus|ideia|futura|gerp|palver|veritá|verita|paraná|parana|indexa|vox brasil|alfa inteligência|alfa inteligencia)/i.test(hay)) { score += 35; reasons.push('institute') }
  if (/\.(?:pdf|html?)$/i.test(canonical)) score += 8
  return { url: canonical, score, rejected, reasons }
}

export function isLikelyNationalPresidentialPoll(url, title = '') {
  const c = classifyPollLink(url, title)
  return !c.rejected && c.score >= 35
}
