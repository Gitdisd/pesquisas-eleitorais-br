#!/usr/bin/env node
import fs from 'node:fs'
import crypto from 'node:crypto'

const ROOT = process.cwd()
const BASE_PATH = `${ROOT}/data/polls.json`
const EXTRA_PATHS = [
  `${ROOT}/data/polls-extra.json`,
  `${ROOT}/public/data/polls-extra.json`,
  `${ROOT}/data/polls-extra-wave-2026-09-15.json`,
  `${ROOT}/data/polls-extra-wave-2026-09-16.json`,
  `${ROOT}/data/polls-extra-wave-2026-09-17.json`,
  `${ROOT}/data/polls-extra-wave-2026-09-17-gerp.json`,
]
const OUT_PATH = BASE_PATH

const load = (file) => {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'))
  return Array.isArray(value) ? value : value.polls || []
}

const key = (p) => [
  String(p.institute || '').trim(),
  p.fieldwork_start || '',
  p.fieldwork_end || '',
  p.scenario || '',
].join('|')

const candidateKey = (name) => String(name || '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .trim()

const EXCLUDED_CANDIDATES = new Set(['pablo marcal'])

const isResidual = (name) => /\b(branco|nulo|nao sabe|não sabe|indecis|outros|nao iria votar|não iria votar)\b/i.test(candidateKey(name))

const isGluedResidual = (name) => {
  const k = candidateKey(name)
  const parts = [k.includes('branco') || k.includes('nulo'), k.includes('nao sabe') || k.includes('indecis'), k.includes('outros')]
  return parts.filter(Boolean).length >= 2
}

const dedupeCandidates = (candidates) => {
  const map = new Map()
  for (const c of candidates || []) {
    if (!c || !c.name || typeof c.pct !== 'number' || !Number.isFinite(c.pct)) continue
    if (EXCLUDED_CANDIDATES.has(candidateKey(c.name))) continue
    map.set(candidateKey(c.name), c)
  }
  return [...map.values()]
}

const base = load(BASE_PATH)
const extrasRaw = []
for (const file of EXTRA_PATHS) {
  if (!fs.existsSync(file)) continue
  extrasRaw.push(...load(file))
}

const extras = []
const seenExtra = new Set()
for (const extra of extrasRaw) {
  const k = key(extra)
  if (!k || seenExtra.has(k)) continue
  seenExtra.add(k)
  extras.push(extra)
}

const byKey = new Map()
let addedPolls = 0
let supplementedPolls = 0
let addedCandidateValues = 0
let stagedOnlyPolls = 0
let replacedGluedResiduals = 0
let excludedCandidateValues = 0
const additions = []

for (const poll of base) {
  const cleaned = dedupeCandidates(poll.candidates)
  excludedCandidateValues += (poll.candidates || []).length - cleaned.length
  byKey.set(key(poll), { ...structuredClone(poll), candidates: cleaned })
}

for (const extra of extras) {
  if (!extra?.institute || !extra?.fieldwork_end || !extra?.scenario) continue
  const k = key(extra)
  let existing = byKey.get(k)

  if (!existing) {
    if (extra.verified === true) {
      const copy = structuredClone(extra)
      copy.candidates = dedupeCandidates(copy.candidates)
      byKey.set(k, copy)
      addedPolls += 1
      additions.push({
        type: 'poll',
        institute: extra.institute,
        fieldwork_end: extra.fieldwork_end,
        scenario: extra.scenario,
        source_url: extra.source_url,
      })
      continue
    }
    stagedOnlyPolls += 1
    continue
  }

  const extraCands = dedupeCandidates(extra.candidates)
  const extraSpecific = extraCands.filter((c) => isResidual(c.name) && !isGluedResidual(c.name))
  const before = dedupeCandidates(existing.candidates)
  const glued = before.filter((c) => isGluedResidual(c.name))
  let working = before
  let changed = false

  if (glued.length && extraSpecific.length) {
    working = before.filter((c) => !isGluedResidual(c.name))
    replacedGluedResiduals += glued.length
    changed = true
    additions.push({
      type: 'replace_glued_residual',
      institute: existing.institute,
      scenario: existing.scenario,
      removed: glued.map((c) => `${c.name}=${c.pct}`),
      source_url: extra.source_url,
    })
  }

  const seen = new Map(working.map((c) => [candidateKey(c.name), c]))
  const hasResidual = working.some((c) => isResidual(c.name))

  for (const candidate of extraCands) {
    const ck = candidateKey(candidate.name)
    if (seen.has(ck)) continue
    if (isResidual(candidate.name) && hasResidual && isGluedResidual(candidate.name)) continue
    if (isResidual(candidate.name) && hasResidual && !glued.length) continue
    seen.set(ck, candidate)
    working.push(candidate)
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
    existing.candidates = working
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
const fileChanged = oldText !== newText
if (fileChanged) fs.writeFileSync(OUT_PATH, newText, 'utf8')

const report = {
  version: 4,
  generated_at: new Date().toISOString(),
  identity_key: 'institute|fieldwork_start|fieldwork_end|scenario',
  base_polls: base.length,
  supplemental_rows: extras.length,
  merged_polls: merged.length,
  added_polls: addedPolls,
  staged_only_polls: stagedOnlyPolls,
  supplemented_polls: supplementedPolls,
  added_candidate_values: addedCandidateValues,
  replaced_glued_residuals: replacedGluedResiduals,
  excluded_candidate_values: excludedCandidateValues,
  changed: fileChanged,
  content_sha256: crypto.createHash('sha256').update(newText).digest('hex'),
  additions: additions.slice(0, 250),
}
fs.mkdirSync(`${ROOT}/data/discovery`, { recursive: true })
fs.writeFileSync(`${ROOT}/data/discovery/supplement-merge.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
