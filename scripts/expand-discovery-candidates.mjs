#!/usr/bin/env node
import { CANDIDATES } from '../src/candidates.js'

const presidentialCandidates = CANDIDATES.filter((candidate) => candidate.party)
if (presidentialCandidates.length < 12) {
  throw new Error(
    `Shared candidate registry contains only ${presidentialCandidates.length} presidential candidates; expected at least 12.`,
  )
}

console.log(
  `[expand-discovery-candidates] shared candidate registry active: ${presidentialCandidates.length} presidential candidates`,
)
