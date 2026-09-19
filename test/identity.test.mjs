import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalPollKey,
  normalizeInstitute,
  normalizeProtocol,
  coverageDates,
} from '../src/data/identity.js'

test('publication date is not part of canonical poll identity', () => {
  const a = {
    institute: 'Datafolha',
    fieldwork_start: '2026-09-10',
    fieldwork_end: '2026-09-12',
    published_date: '2026-09-13',
    scenario: 'estimulada 1º turno',
    geo: 'BR',
  }
  const b = { ...a, published_date: '2026-09-15' }
  assert.equal(canonicalPollKey(a), canonicalPollKey(b))
})

test('TSE protocol is preferred over article publication metadata', () => {
  const a = {
    institute: 'Datafolha',
    fieldwork_start: '2026-09-10',
    fieldwork_end: '2026-09-12',
    published_date: '2026-09-13',
    scenario: 'estimulada 1º turno',
    geo: 'BR',
    tse_registration: 'BR-12345/2026',
  }
  const b = { ...a, institute: 'Folha / Datafolha', published_date: '2026-09-16' }
  assert.equal(canonicalPollKey(a), canonicalPollKey(b))
})

test('different fieldwork waves remain distinct without a TSE protocol', () => {
  const a = {
    institute: 'Datafolha',
    fieldwork_start: '2026-09-01',
    fieldwork_end: '2026-09-03',
    scenario: 'estimulada 1º turno',
    geo: 'BR',
  }
  const b = { ...a, fieldwork_start: '2026-09-10', fieldwork_end: '2026-09-12' }
  assert.notEqual(canonicalPollKey(a), canonicalPollKey(b))
})

test('institute aliases normalize consistently', () => {
  assert.equal(normalizeInstitute('Folha / Datafolha'), 'folha / datafolha')
  assert.equal(normalizeInstitute('Genial / Quaest'), 'quaest')
  assert.equal(normalizeProtocol('BR12345/2026'), 'BR-12345/2026')
})

test('coverage dates retain publication witnesses without changing identity', () => {
  const row = {
    published_date: '2026-09-15',
    coverage_dates: ['2026-09-13', '2026-09-15', 'bad'],
  }
  assert.deepEqual(coverageDates(row), ['2026-09-13', '2026-09-15'])
})
