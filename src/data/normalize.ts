import { matchCandidate, parseMoe, isFirstRound, isSecondRound } from '../candidates.js'
import type { NormalizedPoll, RawPoll } from './types'

export function canonicalPollKey(p: RawPoll): string {
  return [p.institute, p.fieldwork_start, p.fieldwork_end, p.published_date, p.scenario].join('|')
}

export function softPollKey(p: RawPoll): string {
  return [p.institute, p.fieldwork_end, p.scenario].join('|')
}

export function mergePolls(base: RawPoll[] = [], extra: RawPoll[] = []): RawPoll[] {
  const map = new Map<string, RawPoll>()
  for (const poll of base) {
    if (!poll?.institute || !poll?.fieldwork_end || !poll?.scenario) continue
    map.set(softPollKey(poll), poll)
  }
  for (const poll of extra) {
    if (!poll?.institute || !poll?.fieldwork_end || !poll?.scenario) continue
    const key = softPollKey(poll)
    // Canonical data wins over the auxiliary feed when both describe the same poll.
    if (!map.has(key) || poll.verified === true) map.set(key, poll)
  }
  return [...map.values()]
}

export function normalizePolls(rows: RawPoll[]): NormalizedPoll[] {
  return rows.map((row, idx) => {
    const scenario = row.scenario || ''
    let round: 1 | 2 | null = null
    if (isSecondRound(scenario)) round = 2
    else if (isFirstRound(scenario)) round = 1
    if (!round) return null

    const results: Record<string, number> = {}
    for (const candidate of row.candidates || []) {
      const match = matchCandidate(candidate.name)
      if (match && typeof candidate.pct === 'number' && Number.isFinite(candidate.pct)) {
        results[match.key] = candidate.pct
      }
    }

    const hasCore = results.lula != null && results.flavio != null
    if (!hasCore) return null

    const end = row.fieldwork_end || row.published_date
    if (!end) return null
    const t = Date.parse(`${end}T12:00:00Z`)
    if (!Number.isFinite(t)) return null

    return {
      id: `${row.institute}-${end}-${round}-${idx}`,
      institute: row.institute,
      published: row.published_date,
      fieldworkStart: row.fieldwork_start,
      fieldworkEnd: end,
      t,
      n: Number(row.n) || 0,
      moe: parseMoe(row.margin_of_error),
      moeRaw: row.margin_of_error,
      method: row.methodology_note || '',
      tse: (row.methodology_note || '').match(/BR-\d+\/\d+/)?.[0] || null,
      scenario,
      round,
      results,
      sourceUrl: row.source_url,
      verified: row.verified !== false,
      flag: row.flag,
    } satisfies NormalizedPoll
  }).filter((value): value is NormalizedPoll => value !== null)
    .sort((a, b) => a.t - b.t)
}
