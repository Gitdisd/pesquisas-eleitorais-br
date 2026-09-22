import { weightedEstimate } from './estimator.js'

let wasmModulePromise = null
let wasmModule = null

function wasmModuleUrl() {
  const base = import.meta.env.BASE_URL || '/'
  return new URL(base + 'wasm/polling-core/polling_core.js', window.location.origin).href
}

export async function loadWasmEstimator() {
  if (typeof window === 'undefined') return null
  if (!wasmModulePromise) {
    wasmModulePromise = import(/* @vite-ignore */ wasmModuleUrl())
      .then(async (module) => {
        if (typeof module.default === 'function') await module.default()
        if (typeof module.weighted_estimate !== 'function' || typeof module.weighted_trend !== 'function') throw new Error('WASM estimator exports missing')
        wasmModule = module
        return module
      })
      .catch(() => null)
  }
  return wasmModulePromise
}

export async function weightedEstimateBrowser(points, options = {}) {
  const wasm = await loadWasmEstimator()
  if (wasm) {
    try {
      const result = wasm.weighted_estimate(
        points || [],
        Number(options.date),
        String(options.candidate ?? ''),
        Number(options.halfLifeDays ?? 14),
      )
      return { ...result, source: 'wasm' }
    } catch {}
  }
  return { ...weightedEstimate(points, options), source: 'js-fallback' }
}

export async function warmWasmEstimator() {
  const fixture = [
    { t: 0, y: 38.0, n: 1200, institute: 'Fixture A' },
    { t: 86_400_000, y: 40.0, n: 2200, institute: 'Fixture B' },
    { t: 2 * 86_400_000, y: 41.0, n: 4000, institute: 'Fixture C' },
  ]
  const options = { date: 2 * 86_400_000, candidate: 'fixture', halfLifeDays: 14 }
  const fallback = weightedEstimate(fixture, options)
  const result = await weightedEstimateBrowser(fixture, options)
  const parityDifference =
    result.estimate == null || fallback.estimate == null
      ? null
      : Math.abs(Number(result.estimate) - Number(fallback.estimate))
  return {
    available: result.source === 'wasm',
    source: result.source,
    parityDifference,
    parityOk: parityDifference == null || parityDifference < 1e-12,
  }
}

export function weightedTrendBrowser(points, options = {}) {
  const halfLifeDays = Number(options.halfLifeDays ?? 14)
  if (wasmModule && typeof wasmModule.weighted_trend === 'function') {
    try {
      const raw = wasmModule.weighted_trend(points || [], halfLifeDays)
      return Array.isArray(raw) ? raw.map((p) => ({ x: Number(p.x), y: Number(p.y) })) : []
    } catch {}
  }

  return []
}

export function wasmTrendReady() {
  return !!wasmModule && typeof wasmModule.weighted_trend === 'function'
}
