#!/usr/bin/env node
import fs from 'node:fs'
import { canonicalPollKey } from '../src/data/identity.js'

const ROOT = process.cwd()
const BASE_PATH = `${ROOT}/data/polls.json`
const EXTRA_PATH = `${ROOT}/data/polls-extra.json`
const INBOX_PATH = `${ROOT}/data/discovery/inbox.json`
const OUT_PATH = `${ROOT}/data/discovery/completeness.json`

const load = (file, fallback) => {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(v) ? v : (v?.polls || fallback)
  } catch {
    return fallback
  }
}

const base = load(BASE_PATH, [])
const extra = load(EXTRA_PATH, [])
const inbox = load(INBOX_PATH, [])

const key = (p) => canonicalPollKey(p)
const norm = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

const baseByKey = new Map(base.map((p) => [key(p), p]))
const missingSupplementValues = []
const conflictingValues = []
const supplementOnlyPolls = []

for (const extraPoll of extra) {
  const existing = baseByKey.get(key(extraPoll))
  if (!existing) {
    supplementOnlyPolls.push({ institute: extraPoll.institute, fieldwork_end: extraPoll.fieldwork_end, published_date: extraPoll.published_date, scenario: extraPoll.scenario, source_url: extraPoll.source_url })
    continue
  }
  const baseMap = new Map((existing.candidates || []).map((c) => [norm(c.name), c]))
  for (const c of extraPoll.candidates || []) {
    const k = norm(c.name)
    if (!k) continue
    const b = baseMap.get(k)
    if (!b) {
      missingSupplementValues.push({
        institute: existing.institute,
        fieldwork_end: existing.fieldwork_end,
        published_date: existing.published_date,
        scenario: existing.scenario,
        candidate: c.name,
        pct: c.pct,
        source_url: extraPoll.source_url,
      })
    } else if (b.pct !== c.pct) {
      conflictingValues.push({
        institute: existing.institute,
        fieldwork_end: existing.fieldwork_end,
        scenario: existing.scenario,
        candidate: c.name,
        base_pct: b.pct,
        supplemental_pct: c.pct,
        base_source_url: existing.source_url,
        supplemental_source_url: extraPoll.source_url,
      })
    }
  }
}

const recentCutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
const recentBase = base.filter((p) => String(p.published_date || '') >= recentCutoff)
const recentInbox = inbox.filter((i) => String(i.published_date || '') >= recentCutoff)

const report = {
  version: 1,
  generated_at: new Date().toISOString(),
  base_poll_count: base.length,
  supplemental_poll_count: extra.length,
  recent_base_poll_count: recentBase.length,
  recent_inbox_count: recentInbox.length,
  missing_supplement_values: missingSupplementValues,
  missing_supplement_value_count: missingSupplementValues.length,
  conflicting_values: conflictingValues,
  conflicting_value_count: conflictingValues.length,
  supplement_only_polls: supplementOnlyPolls,
  supplement_only_poll_count: supplementOnlyPolls.length,
  recent_inbox_samples: recentInbox.slice(0, 50),
}

fs.writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`DATA COMPLETENESS: ${base.length} canonical polls; ${extra.length} supplemental polls`)
console.log(`Missing candidate values recoverable from polls-extra: ${missingSupplementValues.length}`)
console.log(`Supplement-only poll records: ${supplementOnlyPolls.length}`)
console.log(`Conflicting duplicate candidate values: ${conflictingValues.length}`)
console.log(`Recent inbox records (14d): ${recentInbox.length}`)
