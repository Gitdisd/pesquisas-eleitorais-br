#!/usr/bin/env node
import fs from 'node:fs'
import crypto from 'node:crypto'

const polls = JSON.parse(fs.readFileSync('data/polls.json', 'utf8'))
const issues = []

const protocolOf = (p) => {
  const s = [p.methodology_note, p.source_url, p.tse_registration].filter(Boolean).join(' ')
  return s.match(/\bBR-?\d{4,6}\/2026\b/i)?.[0]?.toUpperCase().replace(/^BR(?=\d)/, 'BR-') || null
}
const candidateMap = (p) => new Map((p.candidates || []).map(c => [c.name, Number(c.pct)]))
const sameMap = (a, b) => {
  const x = candidateMap(a)
  const y = candidateMap(b)
  const keys = new Set([...x.keys(), ...y.keys()])
  for (const k of keys) {
    if (x.has(k) && y.has(k) && x.get(k) !== y.get(k)) return false
  }
  return true
}

for (const [i, p] of polls.entries()) {
  const map = candidateMap(p)
  const sum = [...map.values()].reduce((a, b) => a + b, 0)
  const seen = new Set()
  for (const c of p.candidates || []) {
    if (seen.has(c.name)) issues.push({ type: 'duplicate_candidate', poll: i, name: c.name })
    seen.add(c.name)
    if (!Number.isFinite(Number(c.pct)) || Number(c.pct) < 0 || Number(c.pct) > 100) {
      issues.push({ type: 'invalid_percentage', poll: i, name: c.name, pct: c.pct })
    }
  }
  if (sum > 100.001) issues.push({ type: 'candidate_sum_over_100', poll: i, sum })

  const url = String(p.source_url || '').toLowerCase()
  if (p.scenario.includes('1º') && /(2o|2º|segundo)[-_ ]turno/.test(url) && !/(1o|1º|primeiro)[-_ ]turno/.test(url)) {
    issues.push({ type: 'scenario_url_mismatch', poll: i, scenario: p.scenario, source_url: p.source_url })
  }
  if (p.scenario.includes('2º') && /(1o|1º|primeiro)[-_ ]turno/.test(url) && !/(2o|2º|segundo)[-_ ]turno/.test(url)) {
    issues.push({ type: 'scenario_url_mismatch', poll: i, scenario: p.scenario, source_url: p.source_url })
  }
  if (/btg.*nexus|nexus.*btg/.test(url) && p.institute !== 'Nexus/BTG') {
    issues.push({ type: 'institute_source_mismatch', poll: i, institute: p.institute, source_url: p.source_url })
  }
  if (/poderdata|poder-data/.test(url) && p.institute !== 'PoderData') {
    issues.push({ type: 'institute_source_mismatch', poll: i, institute: p.institute, source_url: p.source_url })
  }
}

const identity = new Map()
for (let i = 0; i < polls.length; i += 1) {
  const p = polls[i]
  const protocol = protocolOf(p)
  if (!protocol) continue
  const key = `${protocol}|${p.scenario}`
  if (!identity.has(key)) identity.set(key, i)
  else {
    const j = identity.get(key)
    if (!sameMap(polls[j], p)) issues.push({ type: 'conflicting_same_tse_poll', protocol, scenario: p.scenario, polls: [j, i] })
    else issues.push({ type: 'duplicate_same_tse_poll', protocol, scenario: p.scenario, polls: [j, i] })
  }
}

const report = {
  version: 1,
  status: issues.length ? 'fail' : 'ok',
  issue_count: issues.length,
  poll_count: polls.length,
  content_sha256: crypto.createHash('sha256').update(JSON.stringify(polls)).digest('hex'),
  issues,
}
fs.writeFileSync('data/discovery/integrity.json', `${JSON.stringify(report, null, 2)}\n`)

if (issues.length) {
  for (const issue of issues) console.error(`INTEGRITY FAIL: ${JSON.stringify(issue)}`)
  process.exit(1)
}
console.log(`INTEGRITY OK: ${polls.length} polls checked`)
