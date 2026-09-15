import { matchCandidate, parseMoe, isFirstRound, isSecondRound } from '../candidates.js'
import type { NormalizedPoll, RawPoll } from './types'

export function canonicalPollKey(p: RawPoll): string {
  return [p.institute, p.fieldwork_start, p.fieldwork_end, p.published_date, p.scenario].join('|')
}

export function softPollKey(p: RawPoll): string {
  return [p.institute, p.fieldwork_end, p.scenario].join('|')
}

function mergeCandidates(base = [], extra = []) {
  const merged = []
  const seen = new Map()
  for (const candidate of [...base, ...extra]) {
    if (!candidate?.name || typeof candidate.pct !== 'number' || !Number.isFinite(candidate.pct)) continue
    const key = String(candidate.name).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
    if (seen.has(key)) continue
    seen.set(key, candidate)
    merged.push(candidate)
  }
  return merged
}

export function mergePolls(base: RawPoll[] = [], extra: RawPoll[] = []): RawPoll[] {
  const map = new Map<string, RawPoll>()
  for (const poll of base) {
    if (!poll?.institute || !poll?.fieldwork_end || !poll?.scenario) continue
    map.set(canonicalPollKey(poll), { ...poll, candidates: mergeCandidates(poll.candidates || []) })
  }
  for (const poll of extra) {
    if (!poll?.institute || !poll?.fieldwork_end || !poll?.scenario) continue
    const key = canonicalPollKey(poll)
    const current = map.get(key)
    if (!current) {
      map.set(key, { ...poll, candidates: mergeCandidates(poll.candidates || []) })
      continue
    }
    map.set(key, {
      ...current,
      candidates: mergeCandidates(current.candidates || [], poll.candidates || []),
    })
  }
  return [...map.values()]
}

export function normalizePolls(rows: RawPoll[]): NormalizedPoll[] {
  const out: NormalizedPoll[] = []
  rows.forEach((row, idx) => {
    const scenario = row.scenario || ''
    let round: 1 | 2 | null = null
    if (isSecondRound(scenario)) round = 2
    else if (isFirstRound(scenario)) round = 1
    if (!round) return

    const results: Record<string, number> = {}
    for (const candidate of row.candidates || []) {
      const match = matchCandidate(candidate.name)
      if (match && typeof candidate.pct === 'number' && Number.isFinite(candidate.pct)) {
        results[match.key] = candidate.pct
      }
    }

    if (round === 2 && (results.lula == null || results.flavio == null)) return
    if (round === 1 && results.lula == null && results.flavio == null) return

    const end = row.fieldwork_end || row.published_date
    if (!end) return
    const t = Date.parse(`${end}T12:00:00Z`)
    if (!Number.isFinite(t)) return

    const poll: NormalizedPoll = {
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
      ...(row.flag != null ? { flag: row.flag } : {}),
    }
    out.push(poll)
  })
  return out.sort((a, b) => a.t - b.t)
}
