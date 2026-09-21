import test from 'node:test'
import assert from 'node:assert/strict'
import { weightedEstimate } from '../src/stats/estimator.js'

test('canonical estimator matches real polling fixture', () => {
  const points = [
    ['2026-09-19',40500,41.76],['2026-09-17',2002,39],['2026-09-16',5018,44.1],['2026-09-16',2400,37],
    ['2026-09-16',3000,37],['2026-09-15',2000,38.3],['2026-09-14',2000,39],['2026-09-13',2002,40.5]
  ].map(([d,n,y]) => ({t:Date.parse(d+'T00:00:00Z'),n,y}))
  const r = weightedEstimate(points,{date:Date.parse('2026-09-19T00:00:00Z'),candidate:'lula'})
  assert.equal(r.estimate.toFixed(6),'39.844919')
  assert.equal(r.effectiveSampleSize.toFixed(6),'7.627807')
  assert.equal(r.lower,null)
  assert.equal(r.upper,null)
})
