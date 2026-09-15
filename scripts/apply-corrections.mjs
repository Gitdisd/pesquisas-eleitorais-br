#!/usr/bin/env node
import fs from 'node:fs'

const pollsPath = 'data/polls.json'
const correctionsPath = 'data/discovery/corrections.json'

const polls = JSON.parse(fs.readFileSync(pollsPath, 'utf8'))
const doc = JSON.parse(fs.readFileSync(correctionsPath, 'utf8'))

const protocolOf = (p) => {
  const text = [p.methodology_note, p.source_url, p.tse_registration].filter(Boolean).join(' ')
  return text.match(/\bBR-?\d{4,6}\/2026\b/i)?.[0]?.toUpperCase().replace(/^BR(?=\d)/, 'BR-') || null
}

let changed = false
const working = []

for (const poll of polls) {
  let removed = false
  for (const rule of doc.rules || []) {
    if (rule.action !== 'remove_exact') continue
    const okInstitute = !rule.match.institute || poll.institute === rule.match.institute
    const okUrl = !rule.match.source_url_contains || String(poll.source_url || '').includes(rule.match.source_url_contains)
    if (okInstitute && okUrl) {
      changed = true
      removed = true
      console.log(`[corrections] removed ${rule.id}: ${poll.institute} ${poll.source_url}`)
      break
    }
  }
  if (!removed) working.push(poll)
}

for (const rule of doc.rules || []) {
  if (!['replace_by_tse_and_source', 'ensure_record'].includes(rule.action)) continue
  const targetProtocol = rule.match.tse_registration
  const targetScenario = rule.match.scenario
  const idx = working.findIndex((p) => protocolOf(p) === targetProtocol && p.scenario === targetScenario)

  if (rule.action === 'replace_by_tse_and_source') {
    if (idx >= 0) {
      const current = JSON.stringify(working[idx])
      const next = JSON.stringify(rule.record)
      if (current !== next) {
        working[idx] = rule.record
        changed = true
        console.log(`[corrections] replaced ${rule.id}`)
      }
    } else {
      working.push(rule.record)
      changed = true
      console.log(`[corrections] added missing replacement ${rule.id}`)
    }
  }

  if (rule.action === 'ensure_record' && idx < 0) {
    working.push(rule.record)
    changed = true
    console.log(`[corrections] added ${rule.id}`)
  }
}

if (changed) {
  working.sort((a, b) => {
    if (a.fieldwork_end !== b.fieldwork_end) return a.fieldwork_end < b.fieldwork_end ? 1 : -1
    if (a.published_date !== b.published_date) return a.published_date < b.published_date ? 1 : -1
    return String(a.scenario).localeCompare(String(b.scenario))
  })
  fs.writeFileSync(pollsPath, `${JSON.stringify(working, null, 2)}\n`)
  console.log(`[corrections] wrote ${working.length} polls`)
} else {
  console.log('[corrections] no changes')
}
