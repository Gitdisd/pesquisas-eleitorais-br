# Conversation → Repository Audit — 2026-09-21

## Scope

Source reviewed: the uploaded project conversation export `Past_conversation_access.md`.

The export contains the retained project thread from the first continuity question through the migration audit request: **15 user turns** and the corresponding assistant work. It is not evidence about unrelated conversations that were not included in this export.

This audit maps:
`user request → research/decision → claimed implementation → repository evidence → validation state → remaining gap`.

## User-request ledger

| User turn | Request / decision | Repository status |
|---|---|---|
| 1 | Preserve continuity after context-window crashes | Contextual; no code action required |
| 2 | Identify the polling site/project | Confirmed as `Gitdisd/pesquisas-eleitorais-br` |
| 3 | Check new polls, update chart/tables, verify site, and keep documentation synchronized | **Implemented historically; current end-to-end browser validation remains open.** The repository currently has 240 canonical poll records and synchronized public data, including the verified September 21 Quaest, BTG/Nexus and Palver releases. |
| 4 | Deep audit every aspect of the bottom chart, research alternatives, and propose a stronger architecture without sacrificing maneuverability | **Research completed.** The full issue set was captured in `docs/GPT-CHECK.md`; implementation is partial and ongoing. |
| 5 | Save the chart audit as `GPT-CHECK` and preserve TradingView-style maneuverability | **Completed.** `docs/GPT-CHECK.md` exists and explicitly preserves that requirement. |
| 6 | Use the checklist for future changes; question JS/Vite stack | **Completed as process.** The checklist is the governing engineering reference. |
| 7 | Challenge Lightweight Charts and TypeScript choices | **Resolved.** Neither was made mandatory. |
| 8 | Investigate a much broader set of languages/stacks | **Research completed.** Options included Python, Rust/WASM, Go/WASM, C++/WASM, Julia, R/Shiny, Dart, Kotlin/Wasm, ClojureScript, Scala.js, and multiple visualization engines. |
| 9 | Clarify whether Rust + Python meant backend + visualization | **Clarified.** They were separated into statistical/research and browser/visualization layers. |
| 10 | Begin migration to Python + Rust + ECharts | **Implemented.** ECharts is the production renderer; Python and Rust canonical statistical scaffolds exist. |
| 11 | Continue migration | **Implemented/validated in stages.** Canonical PollObservation/PollWeight contract exists in JS/Python/Rust. |
| 12 | Continue | **Implemented/validated in stages.** Canonical estimator interface and real-data golden fixture exist. |
| 13 | Continue | **Implemented.** Model-selector fix, canonical weighting alignment, and rolling-origin framework added. |
| 14 | Register future tasks and mark them complete as work proceeds | **Implemented.** Persistent tracker is GitHub issue #14. |
| 15 | Empirically audit the whole conversation and identify anything left out | **This document.** Gaps below are now explicitly tracked. |

## What is actually complete

### Data / pipeline hardening

- Automatic refresh bug `normalize(nextRaw)` → `normalizePolls(nextRaw)` was fixed.
- Round-2 y-axis is dynamically derived rather than hard-coded to a minimum of 30.
- Model-selector drift for models 6–12 was corrected.
- Poll identity/deduplication work, witness handling, discovery staging, TSE queues, and national/state separation are represented in the current repository.
- Current canonical `data/polls.json` contains **240 records**, spanning 2026-01-12 through 2026-09-20.
- The current canonical and public poll files use the same content blob in the repository.
- The September 21 Quaest, BTG/Nexus and Palver releases were subsequently source-checked and added with TSE registrations and witness URLs; the current data snapshot is 240 records.

### Architecture migration

- ECharts replaced Chart.js in the public chart renderer.
- Python research/backtesting package exists.
- Rust statistical core exists with WASM-facing bindings.
- Canonical sample-size convention is centralized at floor 100 / fallback 800 / cap 4,000 / reference 2,000.
- Canonical recency weighting is implemented across JS/Python/Rust.
- Canonical estimator result shape includes date, candidate, estimate, lower, upper and effective sample size.
- A real-data golden fixture agrees across the reference implementations.
- Rolling-origin backtesting exists and now treats same-day polling observations as a date-level group rather than allowing arbitrary within-day ordering.

### Chart interaction preservation

The migration retained ECharts dataZoom, slider navigation, crosshair/axis inspection, touch pinch support, and reset controls. The latest audit pass also changed tooltip classification to use `seriesRole` instead of parsing human-readable labels, and preserves the existing dataZoom viewport when an automatic refresh updates the chart.

## Gaps that remain

### 1. Live-site validation

The conversation repeatedly distinguished GitHub Pages deployment success from actual browser-level validation. The environment could not independently fetch/render the live Pages site.

Still open:
- browser smoke test after the latest ECharts fixes;
- desktop/mobile interaction test;
- runtime console error check;
- verify chart and table visually consume the same refreshed dataset;
- verify viewport preservation with a real refresh/new-poll event.

### 2. Statistical uncertainty remains uncalibrated in production

`uncertaintyBand()` remains a separate hand-built uncertainty calculation rather than an interval calibrated to the displayed estimator through rolling-origin coverage.

Still open:
- residual collection by horizon;
- empirical coverage;
- interval calibration;
- sparse/dense/tracking-heavy stratification;
- explicit separation of sampling, heterogeneity, model and forecast uncertainty.

### 3. Projection validation is now materially advanced, but production calibration remains incomplete

`projection-v2.js` still contains a single seven-day holdout gate and hand-built forecast uncertainty.

Completed research layers:
- rolling-origin validation of projection-v2;
- comparison against persistence on the same scored origins;
- multi-fold interval calibration diagnostics;
- no production projection behavior was changed.

Still open:
- model-2-specific interval calibration and density stratification;
- broader temporal/subgroup validation before any production projection change.

### 4. Duplicate statistical implementations are partially reconciled

The advanced models and house-effect logic still have multiple implementations.

Completed:
- house-effect implementation was centralized;
- model families 3–12 now have direct rolling-origin diagnostics;
- canonical estimator equivalence against production weightedTrendV1 is regression-checked.

Still open:
- remove remaining model-specific duplicate primitives only after broader equivalence review.

### 5. First-round composition remains unresolved

Candidate trajectories are still estimated independently.

Still open:
- formally decide between independent series and a compositional model;
- evaluate log-ratio/softmax alternatives with backtesting;
- document the chosen interpretation rather than silently rescaling.

### 6. Tracking-poll overlap remains only partially modeled

The repository has flood/duplicate controls and richer identity metadata, but this is not equivalent to a validated correlation model for overlapping tracking surveys.

Still open:
- quantify overlap/correlation treatment;
- add dedicated overlapping-tracking tests;
- validate the effect on historical estimates.

### 7. Research overlays remain conceptually experimental

SMA/EMA/HMA/VWMA/KAMA/Bollinger remain available as chart overlays.

Still open:
- decide whether they belong in the public default;
- clearly label them as experimental analytics if retained;
- remove the implication that Bollinger-style bands represent polling uncertainty;
- revisit raw sample size being used as VWMA “volume”.

### 8. ECharts hardening is not fully closed

The current renderer now has semantic series roles and viewport preservation logic, but these still need real browser validation.

Still open:
- deep zoom/pan/pinch testing;
- range/reset behavior after refresh;
- accessibility fallback;
- responsive sizing;
- high-density tooltip behavior;
- performance across mobile/desktop.

### 9. Rust/WASM browser path is implemented but live-runtime validation remains open

The Rust crate and WASM-facing API exist, but the browser build/adapter is not yet the production statistical path.

Completed:
- reproducible WASM build in CI and Pages workflow;
- browser adapter with JS fallback;
- generated-package JS/WASM parity test;
- canonical estimator equivalence regression guard.

Still open:
- live browser smoke test and deployed-runtime verification;
- removal of remaining duplicate JS primitives beyond the validated weighted estimator.

### 10. Backtest reporting is not yet a durable benchmark artifact

The corrected backtest runner exists, and a current real-data calculation was performed during this audit:

| Model | Horizon | n | MAE | RMSE |
|---|---:|---:|---:|---:|
| persistence | 1d | 356 | 2.7174 | 3.4531 |
| canonical-weighted | 1d | 356 | 1.9881 | 2.6146 |
| persistence | 3d | 350 | 2.6534 | 3.3858 |
| canonical-weighted | 3d | 350 | 1.8930 | 2.5536 |
| persistence | 7d | 338 | 2.6898 | 3.4504 |
| canonical-weighted | 7d | 338 | 2.0297 | 2.6980 |

These are **research diagnostics on the current dataset**, not a political forecast and not a final model-selection verdict.

Still open:
- save benchmark output as a reproducible artifact;
- stratify results by scenario, candidate, density and tracking intensity;
- validate against multiple model families;
- use the results only after leakage/target-definition review.

## Newly discovered documentation inconsistencies

The audit found two stale statements that had survived the migration:

- `docs/SYSTEM.md` still described `src/chart.js` as Chart.js and referenced `src/models-advanced.js`.
- `docs/MODELS.md` still described model 1 with `exp(-days/window)`, while the canonical implementation now uses half-life-style `2^(-days/window)`.

These were corrected during this audit.

## Important methodological distinction

The conversation contained several ideas that were **researched but intentionally not implemented**, especially:
- Lightweight Charts;
- a mandatory TypeScript migration;
- browser-side Python/Pyodide as the main production engine;
- fully compositional candidate modeling;
- bootstrap/posterior uncertainty;
- removal of all technical overlays.

Those are not forgotten tasks. They are design/research branches that remain candidates only where the current tracker explicitly says evaluation is still open.

## Acceptance rule going forward

A task counts as complete only when the repository implementation, relevant tests, CI/deployment evidence, and live/browser behavior (where applicable) all agree. A prior assistant statement that something was “done” is not sufficient evidence by itself.
