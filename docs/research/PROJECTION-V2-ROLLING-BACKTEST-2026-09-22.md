# Projection-v2 rolling-origin validation — 2026-09-22

## Purpose

This report validates the current production projection-v2 implementation against historical polling data using rolling origins. It does not change production projection behavior and does not constitute an election forecast.

The evaluator mirrors the production path:
1. estimate institute house effects with the canonical sample-size cap/floor;
2. debias the historical observations;
3. compute weightedTrendV2 with recency and institute-flood weighting;
4. apply the existing 7-day holdout gate;
5. for gate-passing origins, fit the current production projection with its 14-day horizon, slope cap, campaign-dependent process noise and band floor;
6. score each requested horizon against the first available observation date at or after the nominal target date, provided it remains inside the 14-day production cap;
7. compare model error with same-origin persistence.

## Current data and reproducibility

The CI backtest used the current 240-record data/polls.json snapshot.

- CI source run: 35676056704
- Polling backtest artifact: polling-backtest-50769d702ea99b32e47c2c539b7eca03f056e8cd
- Artifact digest: sha256:230e35c7c780864ab59d70395d6ebf77d9501633e68a954da606cb9517793346
- Latest publication date in the dataset: 2026-09-21
- Latest fieldwork end: 2026-09-20

The research evaluator lives at python/pebr_stats/projection_v2_backtest.py and is included in the CI backtest report.

## Gate availability

Across 364 eligible historical origins, the existing model-2 holdout gate passed on 207 origins.

| Gate diagnostic | Value |
|---|---:|
| Eligible origins | 364 |
| Gate-passing origins | 207 |
| Pass rate | 56.87% |

The accuracy results below are therefore conditional on the production gate allowing a projection. The gate pass rate is a historical availability diagnostic, not a forecast probability.

## Out-of-sample results on gate-passing origins

Persistence is evaluated on the same scored origins and against the same date-level actual.

| Horizon | n | Model MAE | Model RMSE | Nominal band coverage | Persistence MAE | Persistence RMSE |
|---|---:|---:|---:|---:|---:|---:|
| 1 day | 202 | 1.8634 | 2.4733 | 88.12% | 2.6519 | 3.3939 |
| 3 days | 192 | 1.8251 | 2.4924 | 91.67% | 2.6141 | 3.3311 |
| 7 days | 174 | 1.9851 | 2.6319 | 89.08% | 2.6946 | 3.4135 |
| 14 days | 105 | 1.8495 | 2.4855 | 87.62% | 2.4290 | 3.3271 |

These are historical diagnostics only. Nominal band coverage measures the current uncalibrated production band on the scored origins; it is not evidence that the band is a calibrated 90% interval.

## Interpretation

On the current dataset and protocol, model-2 point-error diagnostics are lower than same-origin persistence at 1, 3 and 7 days on gate-passing origins. At 14 days, model-2 MAE is lower than persistence while model-2 RMSE is also lower in this sample; the persistence comparison remains conditional on the same selected origins.

The interval results remain mixed by horizon. Coverage is near the nominal 90% target but is not uniformly at it, which is why interval calibration remains a separate research task.

The production gate is selective. Future evaluation should therefore continue to report both conditional accuracy and projection availability rather than collapsing them into a single measure.

No production model-2 constants were changed as a result of this research.

## Remaining statistical work

1. Perform model-2 interval calibration with multiple temporal folds, separate from model-1 calibration.
2. Examine interval coverage by horizon and poll-density regime.
3. Track gate availability by scenario/candidate series and temporal period.
4. Compare the model-2 path with models 3–12 under compatible temporal folds without selecting a production winner from aggregate error alone.

## Validation status

The 240-record CI artifact passed the repository validation chain used for the data release, including the real-data rolling backtest and integrity checks.
