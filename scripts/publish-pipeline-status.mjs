#!/usr/bin/env node
import fs from 'node:fs'

const mappings = [
  ['data/discovery/coverage-status.json', 'public/data/pipeline-status.json'],
  ['data/discovery/missing-registered.json', 'public/data/missing-registered.json'],
  ['data/discovery/conflicts.json', 'public/data/poll-conflicts.json'],
  ['data/discovery/pending-polls.json', 'public/data/pending-polls.json'],
  ['data/discovery/witnesses.json', 'public/data/witnesses.json'],
  ['data/discovery/registry-queues.json', 'public/data/registry-queues.json'],
]

for (const [source, target] of mappings) {
  if (!fs.existsSync(source)) continue
  const text = fs.readFileSync(source, 'utf8')
  const previous = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null
  fs.mkdirSync(target.replace(/\/[^/]+$/, ''), { recursive: true })
  if (text !== previous) fs.writeFileSync(target, text)
}

console.log('[pipeline-status] public recovery/integrity reports synchronized')
