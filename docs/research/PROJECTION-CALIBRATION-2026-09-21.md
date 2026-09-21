# Projection interval calibration — 2026-09-21

## Scope

Research-only evaluation of the current public projection interval formula in `src/projection.js` against the current verified `data/polls.json` dataset.

The evaluation is leakage-safe:

- Each historical origin uses only polls with fieldwork-end dates at or before that origin.
- Same-day future polls are aggregated to a date-level mean before scoring.
- The production weighted trend uses the canonical sample-size cap and recency contract.
- Projection intervals are evaluated at the first observed date on or after each requested horizon.

## Current production interval coverage

| Horizon | n | MAE (pp) | RMSE (pp) | Current interval coverage |
|---:|---:|---:|---:|---:|
| 1 day | 348 | 1.9883 | 2.6063 | 80.17% |
| 3 days | 334 | 1.9113 | 2.5555 | 83.23% |
| 7 days | 302 | 1.9976 | 2.6477 | 80.13% |
| 14 days | 156 | 2.0068 | 2.6266 | 81.41% |

The current production code uses `z=1.645`, normally associated with an approximately 90% normal interval. The observed historical coverage is substantially below that nominal target, so the existing envelope should not be described as empirically calibrated.

## Temporal calibration experiment

A 70% / 30% split was made by historical origin date. For each horizon, the scale factor was chosen from the 90th percentile of:

`abs(error) / current_half_width`

on the earlier calibration origins only. The factor was then applied unchanged to the later validation origins.

| Horizon | Calibration n | Validation n | Factor | Calibration coverage | Validation coverage |
|---:|---:|---:|---:|---:|---:|
| 1 day | 248 | 100 | 1.2590 | 89.92% | 89.00% |
| 3 days | 240 | 94 | 1.1818 | 90.00% | 88.30% |
| 7 days | 220 | 82 | 1.3414 | 90.00% | 91.46% |
| 14 days | 108 | 48 | 1.2706 | 89.81% | 87.50% |

## Interpretation

This supports three implementation conclusions:

1. The current projection interval is under-dispersed relative to historical out-of-sample error.
2. A single universal multiplier is unlikely to be ideal; horizon-specific calibration preserves the existing heteroskedastic width structure.
3. The validation sample, especially at 14 days, is limited, so these factors are research estimates rather than permanent constants.

## Next step

Before using these factors in production:

- repeat the evaluation across additional temporal folds rather than one 70/30 split;
- evaluate scenario/candidate-specific coverage;
- validate model 2 / `projection-v2.js` separately;
- check coverage stability after new poll waves enter the dataset;
- only then introduce calibrated factors into the public projection path.

No election outcome, candidate ranking, or win probability is inferred by this analysis.
