/**
 * Field as of 9 Sep 2026 (TSE / O Globo / G1).
 * 13 registered. Pablo Marçal (PRTB) is ineligible through 2032 and is omitted
 * from cards/lines; polls that still test him are ignored for the series.
 * Dropped/replaced before registro: Cabo Daciolo, Joaquim Barbosa, Aldo Rebelo, Heró Bezerra.
 */
export const CANDIDATES = [
  { key: 'lula', names: ['Lula', 'Luiz Inácio Lula da Silva'], label: 'Lula', party: 'PT', number: '13', tier: 'lead', color: '#c62828', borderDash: [], borderWidth: 2.5 },
  { key: 'flavio', names: ['Flávio Bolsonaro', 'Flavio Bolsonaro'], label: 'Flávio Bolsonaro', party: 'PL', number: '22', tier: 'lead', color: '#009c3b', borderDash: [], borderWidth: 2.5 },
  { key: 'cury', names: ['Augusto Cury', 'Escritor Augusto Cury', 'Cury'], label: 'Augusto Cury', party: 'Avante', number: '70', tier: 'lead', color: '#b45309', borderDash: [8, 4], borderWidth: 2 },
  { key: 'renan', names: ['Renan Santos', 'Renan'], label: 'Renan Santos', party: 'Missão', number: '14', tier: 'lead', color: '#6d28d9', borderDash: [2, 3], borderWidth: 2 },
  { key: 'caiado', names: ['Ronaldo Caiado', 'Caiado'], label: 'Ronaldo Caiado', party: 'PSD', number: '55', tier: 'lead', color: '#4d7c0f', borderDash: [10, 4, 2, 4], borderWidth: 2 },
  { key: 'zema', names: ['Romeu Zema', 'Zema'], label: 'Romeu Zema', party: 'Novo', number: '30', tier: 'lead', color: '#ea580c', borderDash: [16, 6], borderWidth: 2 },
  { key: 'samara', names: ['Samara Martins', 'Samara'], label: 'Samara Martins', party: 'UP', number: '80', tier: 'field', color: '#0284c7', borderDash: [4, 4], borderWidth: 1.6 },
  { key: 'hertz', names: ['Hertz Dias', 'Hertz'], label: 'Hertz Dias', party: 'PSTU', number: '16', tier: 'field', color: '#475569', borderDash: [3, 3], borderWidth: 1.6 },
  { key: 'edmilson', names: ['Edmilson Costa', 'Edmilson Dias', 'Edmilson'], label: 'Edmilson Costa', party: 'PCB', number: '21', tier: 'field', color: '#9f1239', borderDash: [5, 3], borderWidth: 1.6 },
  { key: 'rui', names: ['Rui Costa Pimenta', 'Rui Costa', 'Pimenta'], label: 'Rui Costa Pimenta', party: 'PCO', number: '29', tier: 'field', color: '#0f766e', borderDash: [7, 3], borderWidth: 1.6 },
  { key: 'clariana', names: ['Clariana Barão', 'Clariana Barao', 'Clariana'], label: 'Clariana Barão', party: 'DC', number: '27', tier: 'field', color: '#7c3aed', borderDash: [2, 2], borderWidth: 1.6 },
  { key: 'grassi', names: ['Wilson Grassi', 'Veterinário Wilson Grassi', 'Grassi'], label: 'Wilson Grassi', party: 'Democrata', number: '35', tier: 'field', color: '#57534e', borderDash: [1, 3], borderWidth: 1.6 },
]

export function matchCandidate(name) {
  if (!name) return null
  const n = String(name).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
  const skip = ['pablo marcal', 'marcal', 'pablo']
  if (skip.some((s) => n === s || n.includes(s))) return null
  let best = null
  let bestLen = 0
  for (const c of CANDIDATES) {
    for (const raw of c.names) {
      const x = raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      if (n === x || n.includes(x) || x.includes(n)) {
        if (x.length > bestLen) {
          best = c
          bestLen = x.length
        }
      }
    }
  }
  return best
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
