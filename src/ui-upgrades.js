// UI-only helpers for the dashboard refresh. Kept dependency-free so the static site stays lightweight.
export function formatCount(n) {
  return Number(n || 0).toLocaleString('pt-BR')
}

export function latestDate(polls) {
  let max = ''
  for (const p of polls || []) {
    const d = p.fieldwork_end || p.fieldworkEnd || p.published_date || p.published || ''
    if (d > max) max = d
  }
  return max
}

export function daysSince(dateText) {
  if (!dateText) return null
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(dateText) ? `${dateText}T12:00:00Z` : dateText)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}

export function freshnessClass(days) {
  if (days == null) return ''
  if (days <= 3) return 'fresh'
  if (days <= 7) return 'warm'
  return 'stale'
}
