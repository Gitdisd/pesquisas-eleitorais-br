export const CANDIDATES = [
  // Lula red · Flávio Brazilian-flag green · others categorical
  { key: 'lula', names: ['Lula', 'Luiz Inácio Lula da Silva'], label: 'Lula', color: '#c62828', borderDash: [], borderWidth: 2.5 },
  { key: 'flavio', names: ['Flávio Bolsonaro', 'Flavio Bolsonaro'], label: 'Flávio Bolsonaro', color: '#009c3b', borderDash: [], borderWidth: 2.5 },
  { key: 'cury', names: ['Augusto Cury', 'Cury'], label: 'Augusto Cury', color: '#b45309', borderDash: [8, 4], borderWidth: 2 },
  { key: 'renan', names: ['Renan Santos', 'Renan'], label: 'Renan Santos', color: '#6d28d9', borderDash: [2, 3], borderWidth: 2 },
  { key: 'caiado', names: ['Ronaldo Caiado', 'Caiado'], label: 'Ronaldo Caiado', color: '#4d7c0f', borderDash: [10, 4, 2, 4], borderWidth: 2 },
  { key: 'zema', names: ['Romeu Zema', 'Zema'], label: 'Romeu Zema', color: '#ea580c', borderDash: [16, 6], borderWidth: 2 },
]

export function matchCandidate(name) {
  if (!name) return null
  const n = String(name).trim().toLowerCase()
  for (const c of CANDIDATES) {
    if (c.names.some((x) => x.toLowerCase() === n || n.includes(x.toLowerCase()))) return c
  }
  return null
}

export function parseMoe(str) {
  if (typeof str === 'number') return str
  if (!str) return null
  const m = String(str).replace(',', '.').match(/([0-9]+(?:\.[0-9]+)?)/)
  return m ? Number(m[1]) : null
}

export function isFirstRound(scenario) {
  const s = (scenario || '').toLowerCase()
  return s.includes('1') || s.includes('primeiro') || s.includes('estimulad')
}

export function isSecondRound(scenario) {
  const s = (scenario || '').toLowerCase()
  return s.includes('2') || s.includes('segundo')
}
