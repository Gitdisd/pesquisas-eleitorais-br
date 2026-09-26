# Go/WASM UI parity pass — 2026-09-26

## Change timestamp
- UTC: 2026-09-26T15:39:14Z
- America/Sao_Paulo: 2026-09-26 12:39:14 -03:00

## Purpose
This pass rebuilds the browser-facing dashboard in Go/WebAssembly instead of continuing the Rust/Dioxus browser path. The existing production site remains protected until the replacement passes its hosted gates.

## Rewritten feature surface
- Portuguese and English labels plus persisted language choice.
- Light, dark, CRT amber, CRT green, and existing named visual themes.
- Overview metrics, quick navigation, refresh, chart, cards, table, regional panel, and methodology.
- Round, geography, candidate, range, averaging-window, and custom-window controls.
- Models 1–12 with their documented statistical families.
- Multi-institute include/exclude filtering.
- Candidate-line visibility controls.
- SMA 7/21, EMA 9/21, HMA 16, VWMA 14, KAMA 10, and Bollinger 20 overlays.
- Estimated aggregate uncertainty bands.
- Model-1 projection and the model-2 holdout-gated projection path.
- SVG chart rendering with native poll-point inspection.
- Zoom/reset, full-screen, share URL, CSV export, JSON export, and selected-poll detail.
- Regional first/second-round and multi-geography filtering with a separate chart/table.
- Local persistence and URL restoration for the main view state.

## Deliberate compatibility decisions
- The old "Focus/Focar" action is not carried into the Go interface because it repeatedly caused migration breakage and is only a navigation convenience.
- No Apache ECharts, Vite, authored application JavaScript/TypeScript, or replacement chart library is introduced.
- Go's generated wasm_exec.js remains a required runtime artifact for the browser target.
- The old Rust/Dioxus implementation remains in the repository until the new implementation has production parity evidence.

## Remaining gates
The replacement still needs the hosted CI/browser checks on this exact revision. Only after those pass should production Pages be cut over.