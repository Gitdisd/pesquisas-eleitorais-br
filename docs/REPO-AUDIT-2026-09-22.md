# Full repository audit — 2026-09-22

## Reference records

The project continuity baseline is the two uploaded conversation records:
- `Past_conversation_access.txt`: original project/conversation record.
- `1.md`: subsequent work/status record.

Current repository evidence was treated as authoritative whenever it was newer than either record.

## Current production state

- Main: `28c059de3e74059742e0f8100f84e4f1ee3b58c8`.
- Canonical polls: 240.
- Latest publication: 2026-09-21.
- Latest fieldwork end: 2026-09-20.
- Last successful pipeline: 2026-09-22T05:10:36Z.
- TSE registry source: official source resolved successfully.
- Witness ledger: 251 entries.
- Integrity: 0 errors, 26 warnings.
- Current refresh watermark: 2026-09-21.

## What was verified

### Data and pipelines
The full refresh path now uses a synchronized lockfile and `npm ci`. Discovery, PDF/OCR recovery, TSE recovery, candidate filtering, supplement merge, completeness audit, integrity audit, data quality gate, Node tests/typecheck, Python tests, Rust tests, real-data backtests, advanced-model backtest, overlap audit, estimator equivalence, Rust/WASM build/parity and production build all passed in the latest successful refresh. The race-safe commit logic successfully published refreshed data without overwriting concurrent `main` changes.

### Frontend/UI
ECharts is the active renderer. Semantic series roles are used. National institute and regional geography filters survive refresh. Legend/dataZoom state survives refresh. Round-2 y-scale is data-derived and no longer clips low-value series. Observed-only right-side padding is small. Inside wheel/move/pinch zoom, slider range navigation, crosshair inspection and reset are preserved.

A browser-only bug was found and fixed: ECharts' ARIA component was overwriting the regional chart's DOM label. The shared chart option now receives an explicit regional role and generates the correct ARIA description.

### Browser/WASM
A dedicated Playwright suite now runs on desktop and Pixel-5-sized mobile Chromium. The corrected run passed 6/6 tests, covering both chart instances, table rendering, accessible chart containers, actual browser WASM execution/parity, round-2 low-value series and zoom/legend preservation.

### Performance
The full ECharts import was replaced with a tree-shaken shared runtime. Measured main bundle size fell from approximately 1,237.96 kB minified / 414.26 kB gzip to approximately 668.75 kB minified / 225.02 kB gzip, with the required chart features retained.

### Statistical architecture
The canonical sample-size cap is centralized at N=4,000. The Python projection-v2 house-effect implementation was consolidated onto the shared estimator. Models 1–12 have executable dispatch and research diagnostics. Model-2, advanced model and multi-fold interval-validation artifacts are retained as research evidence rather than being used to assert a model winner.

## What is still open

1. Tracking-poll overlap: overlap is detected/audited, but a validated production correlation-weighting estimator is not yet integrated.
2. First-round composition: no validated joint log-ratio/softmax/state-space production model has replaced independent candidate trajectories.
3. Production interval calibration: historical multi-fold calibration exists, but the public uncertainty band remains explicitly labelled as estimated.
4. Projection-v2 interval calibration/deeper horizon validation.
5. Experimental overlays: SMA/EMA/HMA/VWMA/KAMA/Bollinger remain available and should remain clearly experimental, not polling-confidence measures.
6. Full JS→TS migration.
7. Deeper accessibility semantics linking chart, controls and tables.
8. Improved redundancy for soft-failing discovery sources.
9. Direct public Pages HTTP/DOM testing from this environment is unavailable because the available browser-fetch path lacks outbound DNS; hosted Chromium is the reproducible runtime test.

## Logs and branches

All current branch tips were enumerated and compared with `main`. Historical repair/research branches that are behind or divergent were not treated as unfinished production work automatically. The full Actions history was enumerated; hundreds of historical non-success runs are mostly cancelled/superseded. Recent relevant failures were read and corrected at log level: lockfile drift, refresh non-fast-forward race, Playwright test discovery, and ECharts ARIA generation.

This audit does not claim that every line of every historical cancelled workflow log was manually read.

## Repository architecture note

The site is a static Vite/GitHub Pages application. There is no conventional long-running backend server. The effective backend/data-processing layer is GitHub Actions plus Node/Python/Rust/WASM, with published JSON/WASM consumed by the browser.

## Research basis

The remaining composition and overlap questions are supported by established compositional time-series and polling-aggregation methodology; current ECharts documentation supports the adopted tree-shaken runtime approach.

## Acceptance

The infrastructure, data-refresh, CI, deployment and browser/runtime foundations are substantially validated. The remaining work is concentrated in statistically substantive methodology (tracking correlation, compositional modelling and calibrated uncertainty/projection) plus further accessibility/discovery redundancy. Those remain open intentionally until separately validated.
