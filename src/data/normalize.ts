import { matchCandidate, parseMoe, isFirstRound, isSecondRound } from '../candidates.js'
import type { CandidateResult, NormalizedPoll, RawPoll } from './types'
import {
  canonicalPollKey,
  fallbackPollKey,
  coverageDates,
  normalizeGeo,
  tseProtocolOf,
} from './identity.js'

function validDate(value: unknown): string | null {
  const s = String(value ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T12:00:00Z`)) ? s : null
}

function mergeCandidates(base: CandidateResult[] = [], extra: CandidateResult[] = []): CandidateResult[] {
  const merged = new Map<string, CandidateResult>()
  const keyOf = (candidate: CandidateResult) =>
    String(candidate.name).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
  for (const candidate of base) {
    if (!candidate?.name || typeof candidate.pct !== 'number' || !Number.isFinite(candidate.pct)) continue
    merged.set(keyOf(candidate), candidate)
  }
  for (const candidate of extra) {
    if (!candidate?.name || typeof candidate.pct !== 'number' || !Number.isFinite(candidate.pct)) continue
    const key = keyOf(candidate)
    if (!merged.has(key)) merged.set(key, candidate)
  }
  return [...merged.values()]
}

function mergePollMetadata(current: RawPoll, incoming: RawPoll): RawPoll {
  const dates = new Set([...coverageDates(current), ...coverageDates(incoming)])
  const witnessUrls = new Set([
    ...(Array.isArray(current.witness_urls) ? current.witness_urls : []),
    ...(Array.isArray(incoming.witness_urls) ? incoming.witness_urls : []),
    current.source_url,
    incoming.source_url,
  ].filter(Boolean))
  const publishedCandidates = [current.published_date, incoming.published_date]
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)))
    .sort()
  return {
    ...current,
    ...incoming,
    published_date: publishedCandidates[0] || current.published_date,
    coverage_dates: [...dates].sort(),
    witness_urls: [...witnessUrls].sort(),
    candidates: mergeCandidates(current.candidates || [], incoming.candidates || []),
    verified: current.verified === true || incoming.verified === true,
  }
}

export function mergePolls(base: RawPoll[] = [], extra: RawPoll[] = []): RawPoll[] {
  const map = new Map<string, RawPoll>()
  const fallbackIndex = new Map<string, string[]>()
  const remember = (key: string, pollKey: string) => {
    const list = fallbackIndex.get(key) || []
    if (!list.includes(pollKey)) list.push(pollKey)
    fallbackIndex.set(key, list)
  }
  const findKey = (poll: RawPoll): string | null => {
    const exact = canonicalPollKey(poll)
    if (map.has(exact)) return exact
    const fallback = fallbackPollKey(poll)
    const candidates = fallbackIndex.get(fallback) || []
    return candidates.length === 1 ? candidates[0] : null
  }
  for (const poll of base) {
    if (!poll?.institute || !poll?.fieldwork_end || !poll?.scenario) continue
    const identityKey = canonicalPollKey(poll)
    const stored = {
      ...poll,
      geo: normalizeGeo(poll.geo),
      coverage_dates: coverageDates(poll),
      witness_urls: [...new Set([...(poll.witness_urls || []), poll.source_url].filter(Boolean))],
      candidates: mergeCandidates(poll.candidates || []),
    }
    map.set(identityKey, stored)
    remember(fallbackPollKey(poll), identityKey)
  }
  for (const poll of extra) {
    if (!poll?.institute || !poll?.fieldwork_end || !poll?.scenario) continue
    const key = canonicalPollKey(poll)
    const matchKey = findKey(poll)
    const current = matchKey ? map.get(matchKey) : undefined
    if (!current) {
      map.set(key, {
        ...poll,
        geo: normalizeGeo(poll.geo),
        coverage_dates: coverageDates(poll),
        witness_urls: [...new Set([...(poll.witness_urls || []), poll.source_url].filter(Boolean))],
        candidates: mergeCandidates(poll.candidates || []),
      })
      remember(fallbackPollKey(poll), key)
      continue
    }
    const mergedKey = matchKey || key
    map.set(mergedKey, mergePollMetadata(current, poll))
    remember(fallbackPollKey(poll), mergedKey)
  }
  return [...map.values()]
}

export function normalizePolls(rows: RawPoll[]): NormalizedPoll[] {
  const out: NormalizedPoll[] = []
  rows.forEach((row) => {
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
    if (round === 1 && (results.lula == null || results.flavio == null)) return

    const end = validDate(row.fieldwork_end || row.published_date)
    if (!end) return
    const start = validDate(row.fieldwork_start || end) || end
    const t = Date.parse(`${end}T12:00:00Z`)
    if (!Number.isFinite(t)) return

    const published = validDate(row.published_date) || end
    const pollKey = canonicalPollKey(row)
    const coverage = coverageDates(row)
    const witnessUrls = [...new Set([
      ...(Array.isArray(row.witness_urls) ? row.witness_urls : []),
      row.source_url,
    ].filter(Boolean))].sort()
    const protocol = tseProtocolOf(row)
    const poll: NormalizedPoll = {
      id: pollKey,
      pollKey,
      institute: row.institute,
      published,
      coverageDates: coverage,
      fieldworkStart: start,
      fieldworkEnd: end,
      t,
      n: Number(row.n) || 0,
      moe: parseMoe(row.margin_of_error),
      moeRaw: row.margin_of_error,
      method: row.methodology_note || '',
      tse: protocol,
      scenario,
      round,
      geo: normalizeGeo(row.geo),
      results,
      sourceUrl: row.source_url,
      witnessUrls,
      verified: row.verified !== false,
      ...(row.flag != null ? { flag: row.flag } : {}),
    }
    out.push(poll)
  })
  return out.sort((a, b) => a.t - b.t || a.published.localeCompare(b.published) || a.institute.localeCompare(b.institute))
}
