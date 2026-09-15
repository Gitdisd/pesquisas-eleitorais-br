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
const additions = []

for (const extra of extras) {
  if (!extra?.institute || !extra?.fieldwork_end || !extra?.scenario) continue
  const k = key(extra)
  const existing = byKey.get(k)
  if (!existing) {
    byKey.set(k, structuredClone(extra))
    addedPolls += 1
    additions.push({ type: 'poll', institute: extra.institute, published_date: extra.published_date, scenario: extra.scenario })
    continue
  }

  const before = dedupeCandidates(existing.candidates)
  const seen = new Map(before.map((c) => [candidateKey(c.name), c]))
  let changed = false
  for (const candidate of dedupeCandidates(extra.candidates)) {
    const ck = candidateKey(candidate.name)
    if (seen.has(ck)) continue
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
  version: 1,
  generated_at: new Date().toISOString(),
  base_polls: base.length,
  supplemental_rows: extras.length,
  merged_polls: merged.length,
  added_polls: addedPolls,
  supplemented_polls: supplementedPolls,
  added_candidate_values: addedCandidateValues,
  changed,
  content_sha256: crypto.createHash('sha256').update(newText).digest('hex'),
  additions: additions.slice(0, 250),
}
fs.writeFileSync(`${ROOT}/data/discovery/supplement-merge.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(JSON.stringify(report, null, 2))
