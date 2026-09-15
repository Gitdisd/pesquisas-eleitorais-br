#!/usr/bin/env node
import fs from 'node:fs'

const path = 'scripts/discover-polls.mjs'
const text = fs.readFileSync(path, 'utf8')
const start = text.indexOf('const CANDIDATE_CANON = [')
if (start < 0) throw new Error('CANDIDATE_CANON block not found')
const end = text.indexOf('\n];', start)
if (end < 0) throw new Error('CANDIDATE_CANON block terminator not found')

const block = `const CANDIDATE_CANON = [
  { keys: ["lula", "luiz inácio", "luiz inacio"], name: "Lula", party: "PT" },
  { keys: ["flávio bolsonaro", "flavio bolsonaro", "flávio", "flavio"], name: "Flávio Bolsonaro", party: "PL" },
  { keys: ["augusto cury", "escritor augusto cury", "cury"], name: "Augusto Cury", party: "Avante" },
  { keys: ["renan santos", "renan"], name: "Renan Santos", party: "Missão" },
  { keys: ["ronaldo caiado", "caiado"], name: "Ronaldo Caiado", party: "PSD" },
  { keys: ["romeu zema", "zema"], name: "Romeu Zema", party: "Novo" },
  { keys: ["samara martins", "samara"], name: "Samara Martins", party: "UP" },
  { keys: ["hertz dias", "hertz"], name: "Hertz Dias", party: "PSTU" },
  { keys: ["edmilson costa", "edmilson dias", "edmilson"], name: "Edmilson Costa", party: "PCB" },
  { keys: ["rui costa pimenta", "rui costa", "pimenta"], name: "Rui Costa Pimenta", party: "PCO" },
  { keys: ["clariana barão", "clariana barao", "clariana"], name: "Clariana Barão", party: "DC" },
  { keys: ["wilson grassi", "veterinário wilson grassi", "grassi"], name: "Wilson Grassi", party: "Democrata" },
];`

const next = text.slice(0, start) + block + text.slice(end + 3)
if (next !== text) fs.writeFileSync(path, next, 'utf8')
console.log('[expand-discovery-candidates] discovery parser now tracks 12 presidential candidates')
