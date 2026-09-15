#!/usr/bin/env node
import fs from 'node:fs'
import crypto from 'node:crypto'

const ROOT = process.cwd()
const BASE_PATH = `${ROOT}/data/polls.json`
const EXTRA_PATHS = [
  `${ROOT}/data/polls-extra.json`,
  `${ROOT}/public/data/polls-extra.json`,
]
const OUT_PATH = BASE_PATH

const load = (file) => {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'))
  return Array.isArray(value) ? value : value.polls || []
}

const key = (p) => [
  p.institute,
  p.fieldwork_start,
  p.fieldwork_end,
  p.published_date,
  p.scenario,
].join('|')

const candidateKey = (name) => String(name || '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .trim()

// Residual response buckets are not interchangeable. They are also the most
// common source of double-counting when two publishers label the same bucket
// differently (for example "não sabe" vs "branco/nulo/não sabe"). Do not
// invent an additional residual bucket on a canonical poll that already has one.
const isResidual = (name) => /\b(branco|nulo|nao sabe|não sabe|indecis|outros)\b/i.test(candidateKey(name))

const dedupeCandidates = (candidates) => {
  const map = new Map()
  for (const c of candidates || []) {
    if (!c || !c.name || typeof c.pct !== 'number' || !Number.isFinite(c.pct)) continue
    map.set(candidateKey(c.name), c)
  }
  return [...map.values()]
}

const base = load(BASE_PATH)
const extras = []
for (const file of EXTRA_PATHS) {
  if (!fs.existsSync(file)) continue
  extras.push(...load(file))
}

const byKey = new Map(base.map((p) => [key(p), structuredClone(p)]))
let addedPolls = 0
let supplementedPolls = 0
let addedCandidateValues = 0
let stagedOnlyPolls = 0
const additions = []

for (const extra of extras) {
  if (!extra?.institute || !extra?.fieldwork_end || !extra?.scenario) continue
  const k = key(extra)
  const existing = byKey.get(k)

  // polls-extra is a supplement/staging layer. A record that has no canonical
  // counterpart must not be promoted here: update-polls / registry validation
  // owns creation of new canonical polls. Keep it in the report instead.
  if (!existing) {
    stagedOnlyPolls += 1
    continue
  }

  const before = dedupeCandidates(existing.candidates)
  const seen = new Map(before.map((c) => [candidateKey(c.name), c]))
  const hasResidual = before.some((c) => isResidual(c.name))
  let changed = false

  for (const candidate of dedupeCandidates(extra.candidates)) {
    const ck = candidateKey(candidate.name)
    if (seen.has(ck)) continue
    if (isResidual(candidate.name) && hasResidual) continue

    seen.set(ck, candidate)
    before.push(candidate)
    addedCandidateValues += 1
    changed = true
    additions.push({
      type: 'candidate',
      institute: existing.institute,
      published_date: existing.published_date,
      scenario: existing.scenario,
      candidate: candidate.name,
      pct: candidate.pct,
      source_url: extra.source_url,
    })
  }

  if (changed) {
    existing.candidates = before
    byKey.set(k, existing)
    supplementedPolls += 1
  }
}

const merged = [...byKey.values()].sort((a, b) =>
  String(b.fieldwork_end).localeCompare(String(a.fieldwork_end)) ||
  String(b.published_date).localeCompare(String(a.published_date)) ||
  String(a.institute).localeCompare(String(b.institute)) ||
  String(a.scenario).localeCompare(String(b.scenario))
)

const oldText = fs.readFileSync(OUT_PATH, 'utf8')
const newText = `${JSON.stringify(merged, null, 2)}\n`
const changed = oldText !== newText
if (changed) fs.writeFileSync(OUT_PATH, newText, 'utf8')

const report = {
  version: 2,
  generated_at: new Date().toISOString(),
  base_polls: base.length,
  supplemental_rows: extras.length,
  merged_polls: merged.length,
  added_polls: addedPolls,
  staged_only_polls: stagedOnlyPolls,
  supplemented_polls: supplementedPolls,
  added_candidate_values: addedCandidateValues,
  changed,
  content_sha256: crypto.createHash('sha256').update(newText).digest('hex'),
  additions: additions.slice(0, 250),
}
fs.writeFileSync(`${ROOT}/data/discovery/supplement-merge.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(JSON.stringify(report, null, 2))
