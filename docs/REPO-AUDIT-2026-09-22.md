# Repository audit — 2026-09-22

This document supersedes the older “done” wording where current repository evidence has changed the status. The uploaded conversation records remain the historical source for the original requirements; this document is the current repository/deployment audit.

## Scope

Audited repository structure and current `main`, current branch tips, pull requests, Actions workflow history and relevant job logs, frontend/backend/statistical code, data/discovery artifacts, GitHub Pages deployment, dependency lockfile behavior, ECharts runtime, Rust/WASM adapter, Python research/backtesting stack, and the production refresh path.

## Current production reference

- Main commit at audit point: `5de164972321fed7c1388f7dc5915e6d3b52e36a`.
- Canonical poll records: 240.
- Latest publication: 2026-09-21.
- Latest fieldwork end: 2026-09-20.
- Last successful pipeline: 2026-09-22T05:10:36.725Z.
- Canonical content hash: `a36540bf2df9b76de04647fc7374462ec176b42401ab2d4f7218ccdab5e97d3b`.
- Official TSE registry source resolved successfully during the latest refresh.
- Discovery watermark: 2026-09-21.
- Witness ledger: 251 entries.
- Integrity audit: 0 errors, 26 warnings.

## Verified completed in this audit

### Data and refresh pipeline

- `npm ci` now works from the authoritative lockfile in CI, Pages, and refresh workflows.
- The refresh workflow performs validation before publication.
- Refresh publication is race-safe: it rebases onto current `origin/main`, retries a moving remote, and never force-overwrites concurrent changes.
- The latest full refresh passed discovery, PDF/OCR recovery, TSE recovery, data completeness, integrity, data quality gate, Node tests/typecheck, Python tests, Rust tests, real-data backtests, advanced-model backtest, overlap audit, estimator equivalence, Rust/WASM build/parity, and production build.
- Pages build/deploy for the optimized main commit passed.
- The latest refresh found 39 new discovery inbox entries but did not promote any unverified poll into the canonical 240-record dataset.

### Frontend / ECharts

- Chart.js has been removed from the active chart path.
- ECharts is now imported through a tree-shaken shared runtime containing only the chart/component/renderer features actually used by the application.
- Main bundle baseline measured at 1,237.96 kB minified / 414.26 kB gzip; tree-shaken build measured at 668.75 kB minified / 225.02 kB gzip.
- Semantic series roles are used for poll, aggregate, uncertainty, projection, and overlay behavior.
- Tooltip data is HTML-escaped before insertion.
- Chart refresh preserves dataZoom viewport and legend visibility.
- Institute selection is preserved across background data refresh.
- Regional geography selection is preserved across refresh.
- Round-2 y-scaling is data-driven rather than clipped to a hard-coded 30% floor.
- The unnecessary fixed 18-day right-side blank area was removed; observed-only mode uses a small margin and projection mode uses the projection horizon.
- ECharts inside zoom, wheel movement, pinch, slider navigation, crosshair inspection, and reset/home behavior remain available.
- Both national and all-sources chart instances are distinct and share the same underlying chart engine.

### WASM / statistics

- Canonical JS/Rust estimator parity is validated by executable tests.
- Browser adapter logic only reports WASM parity when WASM actually executed; JS fallback is no longer falsely reported as parity-successful WASM.
- Python projection-v2 research path now uses the shared house-effect estimator and canonical sample-size cap.
- House-effect duplicate implementation in the Python projection research path is removed.
- Model-2 and model-3–12 research evaluators are reproducible and retained as research artifacts; no unsupported production model-selection claim is made.
- Multi-fold temporal interval calibration is implemented as research tooling and is not silently applied to production.

## Current data/integrity warnings that are not errors

The current integrity audit reports 26 warnings and zero errors. The warnings are primarily:

- source URL / scenario-label mismatches on some older records;
- candidate totals slightly above 100 due rounding/residual conventions.

The current completeness audit reports five supplemental-only Pablo Marçal values that are intentionally not present in the canonical promoted candidate set because the production candidate-eligibility rules remove that candidate from the active canonical data. No conflicting supplemental values were reported.

The discovery system currently has eight soft source-fetch failures. The latest log identifies examples including HTTP 403 on UOL, HTTP 403 on Paraná Pesquisas, 404 on the Portuguese Wikipedia page and Gauchazh page, an unavailable CNT page, 404 on a BBC path, and 401 on the Reuters path. These are treated as discovery-source soft failures; TSE registry acquisition and the primary poll-processing path still completed successfully.

## Browser verification status

A dedicated Chromium smoke suite has been added for desktop and Pixel-5-sized mobile builds. It checks:

- both chart instances;
- table rendering;
- accessible chart containers;
- real browser WASM execution and parity;
- round-2 low-value series visibility;
- zoom preservation;
- legend preservation.

The first browser run failed only on the regional ARIA label. That exposed an actual ECharts ARIA-component interaction and was fixed by making the ECharts-generated ARIA description role-aware. A subsequent run evaluated the corrected source; the current branch continues to carry the suite. Public Pages itself still cannot be directly fetched from the available browser-fetch environment because external DNS access is unavailable, so hosted Chromium build/runtime testing is the stronger application-level evidence available here.

## Statistical work still intentionally open

These are research/production decisions that should not be marked complete merely because supporting code exists:

1. Overlapping tracking polls: the repository can detect overlapping fieldwork windows, but the production estimator does not yet apply a validated correlation-aware weighting model. The current system therefore has an overlap audit, not a fully validated overlap-correlation estimator.
2. First-round composition: candidate shares are constrained proportions. A compositional/log-ratio or coherent simplex/state-space model is a research direction; no new production composition model is being silently introduced.
3. Production uncertainty calibration: multi-fold historical calibration produces approximately 90–92% pooled coverage in the tested historical folds, but production still uses an explicitly labelled estimated uncertainty band rather than a claimed calibrated interval.
4. Projection-v2 interval calibration and long-horizon validation remain separate research tasks.
5. Experimental technical overlays (SMA/EMA/HMA/VWMA/KAMA/Bollinger) remain in the codebase. Their public-product presentation should remain clearly experimental because they are mathematical smoothing/volatility constructs, not polling confidence intervals.
6. Full JavaScript-to-TypeScript migration is incomplete. The project has strong TypeScript contracts around important statistical/data paths, but `allowJs`/unchecked legacy JavaScript still exists.
7. Accessibility can be improved further by connecting the visualization more explicitly to the detailed tables and adding deeper keyboard/data fallback coverage.
8. Direct public-site HTTP/DOM verification remains environment-limited; GitHub deployment success and hosted Chromium smoke builds provide the available evidence.
9. Discovery-source redundancy can be improved so a 403/401/404 on one publisher does not materially reduce recall when alternate mirrors are available.

## Branch / PR hygiene

All current branch tips were enumerated and compared with `main`. Historical repair/research branches that are behind/divergent do not represent current unfinished production work by themselves. The active work that matters at this audit point is the browser E2E suite and the UI/audit documentation synchronization.

## Actions-log audit

The complete Actions history was enumerated. There are hundreds of historical non-success conclusions, mostly cancelled/superseded runs. Relevant current failures were inspected at log level, including:

- stale `package-lock.json` causing `npm ci` EUSAGE;
- refresh non-fast-forward race at final push;
- browser test harness “no tests found” caused by incorrect Playwright config path;
- browser accessibility-label failure caused by ECharts ARIA generation.

Each of those failures produced a concrete code/workflow correction rather than being reclassified as “expected”.

## Research basis for remaining methodology

Compositional-data literature treats proportions as observations constrained to a simplex; log-ratio methods are a standard way to model such data while preserving their relative structure. State-space work on compositional time series explicitly transforms shares into a space suitable for joint forecasting and then returns coherent proportions. These references support keeping first-round composition as a real research item rather than treating candidate lines as unconstrained independent series.

Overlapping tracking polls also require correlation awareness: distinct releases with overlapping fieldwork can contain highly related information, so counting each release as fully independent can overstate effective information. The repository currently audits these windows but has not yet validated a production correlation-weighting scheme.

## Acceptance interpretation

The project is not in a “nothing remains” state.

The infrastructure/data/CI path is substantially hardened and has current green end-to-end repository evidence. The remaining work is concentrated in browser/runtime acceptance, stronger accessibility, discovery redundancy, and statistically substantive research decisions (tracking correlation, compositional first-round modelling, and calibrated uncertainty/projection intervals). Those should remain explicitly open until they have their own reproducible evidence and regression coverage.
