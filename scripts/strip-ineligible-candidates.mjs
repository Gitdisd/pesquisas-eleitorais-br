#!/usr/bin/env node
import fs from 'node:fs'

const POLLS = 'data/polls.json'
const REPORT = 'data/discovery/ineligible-candidate-cleanup.json'

const EXCLUDED = new Set(['pablo marçal','pablo marcal'])
const normalize = (value) => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

const polls = JSON.parse(fs.readFileSync(POLLS, 'utf8'))
let changed = 0
const removals = []

for (const [index, poll] of polls.entries()) {
  if (!Array.isArray(poll.candidates)) continue
  const kept = []
  for (const candidate of poll.candidates) {
    if (EXCLUDED.has(normalize(candidate.name))) {
      removals.push({
        poll: index,
        institute: poll.institute,
        published_date: poll.published_date,
        scenario: poll.scenario,
        candidate: candidate.name,
        pct: candidate.pct,
        source_url: poll.source_url,
      })
      changed++
    } else {
      kept.push(candidate)
    }
  }
  poll.candidates = kept
}

if (changed) fs.writeFileSync(POLLS, `${JSON.stringify(polls, null, 2)}\n`)
fs.writeFileSync(REPORT, `${JSON.stringify({ version: 1, generated_at: new Date().toISOString(), removed: changed, removals }, null, 2)}\n`)
console.log(`[strip-ineligible-candidates] removed=${changed}`)
