#!/usr/bin/env node
import fs from 'node:fs'
import crypto from 'node:crypto'
import { canonicalPollKey, normalizeProtocol } from '../src/data/identity.js'

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const errors = []
const fail = (msg) => errors.push(msg)

const polls = readJson('data/polls.json')
const extra = readJson('data/polls-extra.json')
const meta = readJson('data/meta.json')
const coverage = readJson('data/coverage_summary.json')
const mirror = readJson('public/data/polls.json')
const inbox = readJson('data/discovery/inbox.json')
const lastRun = readJson('data/discovery/last-run.json')

if (!Array.isArray(polls)) fail('data/polls.json is not an array')
if (!Array.isArray(extra)) fail('data/polls-extra.json is not an array')
if (!Array.isArray(mirror)) fail('public/data/polls.json is not an array')
if (JSON.stringify(polls) !== JSON.stringify(mirror)) fail('public/data/polls.json is not identical to data/polls.json')

const required = ['institute','fieldwork_start','fieldwork_end','published_date','scenario','candidates','n','margin_of_error','source_url','methodology_note','verified']
const keys = new Set()
for (const [i, p] of polls.entries()) {
  for (const k of required) if (!(k in p)) fail(`poll ${i} missing ${k}`)
  if (!Array.isArray(p.candidates) || p.candidates.length === 0) fail(`poll ${i} has no candidates`)
  if (!Number.isFinite(Number(p.n)) || Number(p.n) <= 0) fail(`poll ${i} invalid n`)
  if (p.verified !== true) fail(`poll ${i} is not verified`)
  if (!/^https?:\/\//i.test(String(p.source_url))) fail(`poll ${i} invalid source_url`)
  const key = canonicalPollKey(p)
  if (keys.has(key)) fail(`duplicate canonical poll key: ${key}`)
  keys.add(key)
  if (p.fieldwork_start > p.fieldwork_end) fail(`poll ${i} fieldwork dates are reversed`)
  if (p.fieldwork_end > p.published_date) fail(`poll ${i} published_date precedes fieldwork_end`)
  if (p.tse_registration && !normalizeProtocol(p.tse_registration)) fail(`poll ${i} has malformed tse_registration`)
  if (p.coverage_dates && !Array.isArray(p.coverage_dates)) fail(`poll ${i} coverage_dates must be an array`)
  if (Array.isArray(p.coverage_dates)) for (const d of p.coverage_dates) if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(d))) fail(`poll ${i} has invalid coverage date ${d}`)
}

const identitySeen = new Map()
for (const [i, p] of polls.entries()) {
  const key = canonicalPollKey(p)
  const previous = identitySeen.get(key)
  if (previous != null) fail(`duplicate canonical identity at polls ${previous} and ${i}: ${key}`)
  identitySeen.set(key, i)
}

const computedHash = crypto.createHash('sha256').update(JSON.stringify(polls)).digest('hex')
if (meta.content_hash && meta.content_hash !== computedHash) fail('meta.content_hash does not match polls.json')
if (meta.record_count !== polls.length) fail(`meta.record_count=${meta.record_count} but polls=${polls.length}`)
if (!Number.isFinite(Number(meta.check_interval_minutes)) || Number(meta.check_interval_minutes) <= 0) fail('invalid check_interval_minutes')
if (!meta.last_check_at) fail('missing meta.last_check_at')
if (!coverage || typeof coverage !== 'object') fail('coverage summary missing')

if (!inbox || typeof inbox !== 'object' || !Array.isArray(inbox.items)) fail('discovery inbox must be an object with items[]')
if (!lastRun || typeof lastRun !== 'object' || !lastRun.ran_at) fail('discovery last-run is invalid')
if (Array.isArray(inbox.items)) {
  const urls = new Set()
  for (const [i, item] of inbox.items.entries()) {
    if (!item || !item.url) fail(`inbox item ${i} missing url`)
    if (item.url && urls.has(item.url)) fail(`duplicate inbox URL: ${item.url}`)
    if (item.url) urls.add(item.url)
  }
}

if (errors.length) {
  for (const e of errors) console.error(`QUALITY FAIL: ${e}`)
  process.exit(1)
}
console.log(`QUALITY OK: ${polls.length} verified polls; ${inbox.items.length} discovery inbox candidates; hash ${computedHash}`)
