import fs from 'node:fs'

const file = 'src/main.js'
let s = fs.readFileSync(file, 'utf8')

s = s.replace(
  "import { CANDIDATES, matchCandidate, parseMoe, isFirstRound, isSecondRound } from './candidates.js'",
  "import { CANDIDATES } from './candidates.js'\nimport { loadPollData } from './data/api.ts'\nimport { mergePolls, normalizePolls } from './data/normalize.ts'"
)
s = s.replace("function pollKey(p) {\n  return [p.institute, p.fieldwork_end, p.scenario].join('|')\n}\nfunction mergePolls(base, extra) {\n  const map = new Map()\n  for (const p of base || []) map.set(pollKey(p), p)\n  for (const p of extra || []) {\n    if (p && p.institute && p.fieldwork_end && p.scenario) map.set(pollKey(p), p)\n  }\n  return [...map.values()]\n}\n", '')

const oldBoot = /    const \[pollRes, extraRes, meta\] = await Promise\.all\(\[fetch\(DATA_URL\), fetch\(EXTRA_URL\), loadMeta\(\)\]\)[\s\S]*?    state\.polls = normalize\(state\.raw\)/
if (oldBoot.test(s)) {
  s = s.replace(oldBoot, "    const bundle = await loadPollData(DATA_URL, EXTRA_URL, META_URL)\n    state.raw = mergePolls(bundle.polls, bundle.extra)\n    state.polls = normalizePolls(state.raw)")
}

s = s.replace(/async function loadMeta\(noStore = false\) \{[\s\S]*?\n\}\nfunction resolveUpdatedStamp/, 'function resolveUpdatedStamp')

const oldRefresh = /    const \[pollRes, extraRes, meta\] = await Promise\.all\(\[[\s\S]*?    const prevHash = JSON\.stringify\(state\.raw\)/
if (oldRefresh.test(s)) {
  s = s.replace(oldRefresh, "    const bundle = await loadPollData(DATA_URL, EXTRA_URL, META_URL, true)\n    const nextRaw = mergePolls(bundle.polls, bundle.extra)\n    const nextPolls = normalizePolls(nextRaw)\n    const meta = bundle.meta\n    const nextHash = JSON.stringify(nextRaw)\n    const prevHash = JSON.stringify(state.raw)")
}

const normalizeFn = /function normalize\(rows\) \{[\s\S]*?\n\}\nfunction shellHTML/ 
s = s.replace(normalizeFn, 'function shellHTML')

if (/normalize\(state\.raw\)|normalize\(nextRaw\)|function normalize\(/.test(s)) {
  throw new Error('main.js still contains legacy local normalization')
}
if (/function mergePolls|function pollKey|function loadMeta/.test(s)) {
  throw new Error('main.js still contains legacy data helpers')
}
fs.writeFileSync(file, s)
console.log('migrate-main-data-layer: ok')
