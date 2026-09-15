#!/usr/bin/env node
import fs from 'node:fs'

const PATH = 'data/polls.json'
const polls = JSON.parse(fs.readFileSync(PATH, 'utf8'))
let changed = false

const repairs = [
  {
    institute: 'Nexus/BTG',
    fieldwork_start: '2026-09-11',
    fieldwork_end: '2026-09-13',
    published_date: '2026-09-14',
    scenario: 'estimulada 1º turno',
    candidate: { name: 'Samara Martins', party_optional: 'UP', pct: 1 },
    source_url: 'https://noticias.uol.com.br/eleicoes/2026/09/14/btgnexus-presidenciaveis.ghtm',
  },
]

for (const repair of repairs) {
  const poll = polls.find((p) =>
    p.institute === repair.institute &&
    p.fieldwork_start === repair.fieldwork_start &&
    p.fieldwork_end === repair.fieldwork_end &&
    p.published_date === repair.published_date &&
    p.scenario === repair.scenario
  )
  if (!poll) continue

  const existing = (poll.candidates || []).find((c) => c.name === repair.candidate.name)
  if (existing) {
    if (existing.pct !== repair.candidate.pct) {
      throw new Error(`Refusing to overwrite conflicting ${repair.candidate.name} value in ${repair.institute} ${repair.published_date}`)
    }
    continue
  }

  poll.candidates = [...(poll.candidates || []), repair.candidate]
  poll.methodology_note = `${poll.methodology_note || ''} Verified supplemental candidate value from published source: ${repair.source_url}.`.trim()
  changed = true
  console.log(`[known-candidate-repair] added ${repair.candidate.name}=${repair.candidate.pct} to ${repair.institute} ${repair.published_date} ${repair.scenario}`)
}

if (changed) fs.writeFileSync(PATH, `${JSON.stringify(polls, null, 2)}\n`)
console.log(`[known-candidate-repair] changed=${changed}`)
