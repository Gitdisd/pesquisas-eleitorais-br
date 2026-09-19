#!/usr/bin/env node
import fs from 'node:fs'
import crypto from 'node:crypto'
import { canonicalPollKey, normalizeProtocol } from '../src/data/identity.js'

const polls = JSON.parse(fs.readFileSync('data/polls.json', 'utf8'))
const errors = []
const warnings = []


const protocolOf = (p) => {
  const explicit = normalizeProtocol(p.tse_registration)
  if (explicit) return explicit
  const note = String(p.methodology_note || '')
    .replace(/\b(distinct from|not the|diferente de|separate (product|wave) from)[^.]*\./gi, ' ')
  const owned = note.match(/TSE\s+(BR-?\d{4,6}\/2026)/i)
  if (owned) return normalizeProtocol(owned[1])
  const blob = [note, p.source_url].filter(Boolean).join(' ')
  return normalizeProtocol(blob.match(/\bBR-?\d{4,6}\/2026\b/i)?.[0] || null)
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
    if (seen.has(c.name)) errors.push({ type: 'duplicate_candidate', poll: i, name: c.name })
    seen.add(c.name)
    if (!Number.isFinite(Number(c.pct)) || Number(c.pct) < 0 || Number(c.pct) > 100) {
      errors.push({ type: 'invalid_percentage', poll: i, name: c.name, pct: c.pct })
    }
  }

  // Poll percentages are often rounded independently. Small overages such as 100.1
  // or 101.0 are retained as warnings; a large overage is a blocking integrity error.
  if (sum > 101.5) errors.push({ type: 'candidate_sum_over_101_5', poll: i, sum })
  else if (sum > 100.001) warnings.push({ type: 'candidate_sum_over_100_rounding_or_residual', poll: i, sum })

  const url = String(p.source_url || '').toLowerCase()
  const round1InUrl = /(1o|1º|primeiro)[-_ ]turno/.test(url)
  const round2InUrl = /(2o|2º|segundo)[-_ ]turno/.test(url)
  if (p.scenario.includes('1º') && round2InUrl && !round1InUrl) {
    warnings.push({ type: 'scenario_url_mismatch', poll: i, scenario: p.scenario, source_url: p.source_url })
  }
  if (p.scenario.includes('2º') && round1InUrl && !round2InUrl) {
    warnings.push({ type: 'scenario_url_mismatch', poll: i, scenario: p.scenario, source_url: p.source_url })
  }
  if (/btg.*nexus|nexus.*btg/.test(url) && p.institute !== 'Nexus/BTG') {
    errors.push({ type: 'institute_source_mismatch', poll: i, institute: p.institute, source_url: p.source_url })
  }
  if (/poderdata|poder-data/.test(url) && p.institute !== 'PoderData') {
    errors.push({ type: 'institute_source_mismatch', poll: i, institute: p.institute, source_url: p.source_url })
  }
}

const canonicalIdentity = new Map()
for (let i = 0; i < polls.length; i += 1) {
  const key = canonicalPollKey(polls[i])
  const previous = canonicalIdentity.get(key)
  if (previous != null) {
    errors.push({ type: 'duplicate_canonical_identity', key, polls: [previous, i] })
  } else canonicalIdentity.set(key, i)
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
    if (!sameMap(polls[j], p)) {
      errors.push({ type: 'conflicting_same_tse_poll', protocol, scenario: p.scenario, polls: [j, i] })
    } else {
      warnings.push({ type: 'duplicate_same_tse_poll', protocol, scenario: p.scenario, polls: [j, i] })
    }
  }
}

const status = errors.length ? 'fail' : warnings.length ? 'warn' : 'ok'
const report = {
  version: 2,
  status,
  error_count: errors.length,
  warning_count: warnings.length,
  poll_count: polls.length,
  content_sha256: crypto.createHash('sha256').update(JSON.stringify(polls)).digest('hex'),
  errors,
  warnings,
}
fs.writeFileSync('data/discovery/integrity.json', `${JSON.stringify(report, null, 2)}\n`)

for (const warning of warnings) console.warn(`INTEGRITY WARNING: ${JSON.stringify(warning)}`)
for (const error of errors) console.error(`INTEGRITY ERROR: ${JSON.stringify(error)}`)

if (errors.length) process.exit(1)
console.log(`INTEGRITY ${status.toUpperCase()}: ${polls.length} polls checked; ${warnings.length} warnings`)
