export function exposeE2E(name, value) {
  if (import.meta.env.VITE_E2E !== '1' || typeof window === 'undefined') return
  window.__pebrE2E = window.__pebrE2E || {}
  window.__pebrE2E[name] = value
}
