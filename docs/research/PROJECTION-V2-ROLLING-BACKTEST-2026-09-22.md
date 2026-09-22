# Projection-v2 rolling-origin validation — 2026-09-22

## Purpose

This report validates the current production projection-v2 implementation against historical data using rolling origins. It does not change production projection behavior and does not constitute an election forecast.

The evaluator mirrors the production path:

1. estimate institute house effects with the canonical sample-size cap/floor;
2. debias the historical observations;
3. compute the production `weightedTrendV2` smoother with recency and institute-flood weighting;
4. apply the existing 7-day holdout gate;
5. only for gate-passing origins, fit the production projection with the current 14-day horizon, 0.2 pp/day slope cap, campaign-dependent process noise and 2.4 pp band floor;
6. score each requested horizon against the first available poll date at or after the nominal target date;
7. compare model error with persistence on the same scored origins.

The evaluator records target-date lag explicitly, so sparse polling does not silently become a false exact-horizon observation. A future target is accepted when it remains inside the production 14-day projection cap.

## Current data and reproducibility

The CI run used the repository's current `data/polls.json` snapshot:

- 234 raw poll records;
- 8 scenario/candidate groups in the reproducible loader;
- CI run `35675352423`;
- backtest artifact digest `sha256:5cbaa55225424880cd5f501c16fb115c42564ef8fe4c49c3012a95eb2923130c`.

The implementation is in `python/pebr_stats/projection_v2_backtest.py`; the CI runner includes the resulting model-2 section in `backtest-report.json`.

## Gate availability

Across 356 eligible historical origins, the existing model-2 holdout gate passed at 201 origins.

| Gate diagnostic | Value |
|---|---:|
| Eligible origins | 356 |
| Gate-passing origins | 201 |
| Pass rate | 56.46% |

This matters for interpretation: model-2 accuracy below is conditional on the gate allowing a projection. It must not be read as an unconditional model success rate or as a probability of future electoral outcomes.

## Out-of-sample results on gate-passing origins

Persistence is evaluated on the same origins and against the same date-level actual used for the model-2 score.

| Horizon | n | Model MAE | Model RMSE | Nominal band coverage | Persistence MAE | Persistence RMSE |
|---|---:|---:|---:|---:|---:|---:|
| 1 day | 198 | 1.8522 | 2.4563 | 88.38% | 2.6321 | 3.3678 |
| 3 days | 190 | 1.8331 | 2.5030 | 91.58% | 2.6327 | 3.3474 |
| 7 days | 171 | 2.0112 | 2.6539 | 88.89% | 2.7223 | 3.4393 |
| 14 days | 97 | 1.8180 | 2.4084 | 87.63% | 2.4149 | 3.3506 |

These are historical backtest diagnostics only. The nominal band coverage is the coverage of the current uncalibrated production band on these scored origins; it is not evidence that the band is a calibrated 90% interval.

## Interpretation

The rolling-origin evaluation provides evidence that, on the origins where the existing gate permits model-2 projection, its point estimates have lower historical MAE/RMSE than same-origin persistence at all four evaluated horizons in this dataset.

The interval results are less uniform: nominal coverage is near, but not uniformly at, the 90% target. The 1-day and 14-day results are below 90%, while the 3-day and 7-day results are above or near it. This supports keeping calibration as a separate unresolved task rather than changing the production band from these measurements alone.

The gate itself is selective. A complete production-quality evaluation therefore needs to track both point accuracy conditional on projection availability and how often the gate refuses to produce a projection.

No production model-2 constants were changed as a result of this report.

## Remaining statistical work

1. Repeat projection calibration across multiple temporal folds instead of relying on a single 70/30 split.
2. Evaluate interval coverage by horizon and sample-density regime.
3. Compare models 3–12 under the same rolling-origin protocol.
4. Keep the projection-v2 gate unchanged until those broader diagnostics are reviewed.

## Validation status

The evaluator and its regression tests passed the full CI validation chain:

- TypeScript typecheck;
- Rust tests;
- Python tests;
- real-data rolling backtest;
- backtest artifact upload;
- Vite build;
- identity/data-contract tests;
- quality gate;
- integrity audit.

No browser-level live-site smoke test was performed because the available web/container network path could not fetch the GitHub Pages URL.
