export interface CandidateResult {
  name: string
  pct: number
  party_optional?: string | null
}

export interface RawPoll {
  institute: string
  fieldwork_start: string
  fieldwork_end: string
  published_date: string
  scenario: string
  candidates: CandidateResult[]
  n: number
  margin_of_error: string | number
  source_url: string
  methodology_note: string
  verified: boolean
  tse_registration?: string | null
  tse_protocol?: string | null
  geo?: string | null
  coverage_dates?: string[]
  witness_urls?: string[]
  flag?: string | null
  [key: string]: unknown
}

export interface NormalizedPoll {
  id: string
  pollKey: string
  institute: string
  published: string
  coverageDates: string[]
  fieldworkStart: string
  fieldworkEnd: string
  t: number
  n: number
  moe: number | null
  moeRaw: string | number
  method: string
  tse: string | null
  scenario: string
  round: 1 | 2
  geo: string
  results: Record<string, number>
  sourceUrl: string
  witnessUrls: string[]
  verified: boolean
  flag?: string | null
}

export interface PollMeta {
  schema_version?: number
  last_updated?: string
  last_check_at?: string
  check_interval_minutes?: number
  record_count?: number
  source?: string
  content_hash?: string
  pipeline_status?: string
  [key: string]: unknown
}

export interface TrendPoint {
  t: number
  y: number
  n?: number
  institute?: string
  moe?: number | null
}

export interface SeriesPoint {
  x: number
  y: number
}
