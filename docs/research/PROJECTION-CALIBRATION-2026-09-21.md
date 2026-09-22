# Projection interval calibration research — 2026-09-21/22

## Status

This document records historical calibration diagnostics for the public projection interval. These results are research diagnostics, not election forecasts and not production calibration changes.

The production interval remains uncalibrated unless a change is explicitly validated and released. In particular, the displayed band must not be described as a calibrated 90% interval merely because it uses a nominal z value.

## Model 1 — prior rolling audit

The historical audit of the public model-1 projection path found the following nominal interval coverage:

| Horizon | n | MAE | RMSE | Nominal coverage | Median half-width | P90 absolute error |
|---:|---:|---:|---:|---:|---:|---:|
| 1 day | 348 | 1.9883 | 2.6063 | 80.17% | 3.3023 pp | 4.1885 pp |
| 3 days | 334 | 1.9113 | 2.5555 | 83.23% | 3.3146 pp | 3.9325 pp |
| 7 days | 302 | 1.9976 | 2.6477 | 80.13% | 3.3373 pp | 4.4366 pp |
| 14 days | 156 | 2.0068 | 2.6266 | 81.41% | 3.3732 pp | 4.3915 pp |

A single temporal 70/30 calibration experiment produced these research factors:

| Horizon | Calibration n | Validation n | Factor | Calibration coverage | Validation coverage |
|---:|---:|---:|---:|---:|---:|
| 1 day | 248 | 100 | 1.2590 | 89.92% | 89.00% |
| 3 days | 240 | 94 | 1.1818 | 90.00% | 88.30% |
| 7 days | 220 | 82 | 1.3414 | 90.00% | 91.46% |
| 14 days | 108 | 48 | 1.2706 | 89.81% | 87.50% |

Because this uses one temporal split, it is not sufficient on its own to justify deployment.

## Model 2 / projection-v2 — prior audit

The separate model-2 path was evaluated with its own house-effect, flood and holdout-gate logic rather than inheriting model-1 assumptions.

On the earlier 234-record snapshot:

| Horizon | n | Nominal interval coverage | Median half-width |
|---:|---:|---:|---:|
| 1 day | 197 | 88.32% | 3.9579 pp |
| 3 days | 189 | 91.01% | 3.9681 pp |
| 7 days | 170 | 88.82% | 3.9848 pp |

The earlier evaluation had 200 eligible model-2 origins and all passed the internal holdout gate. The later 240-record rolling evaluation is documented separately in `docs/research/PROJECTION-V2-ROLLING-BACKTEST-2026-09-22.md`; that later evaluation found the gate to be selective, so gate availability is now tracked explicitly.

## Multi-fold calibration upgrade

The repository now includes `python/pebr_stats/multifold_projection_calibration.py`.

The evaluator uses expanding temporal folds. For each validation fold, the calibration factor is estimated only from origins strictly earlier than that fold's validation window. The validation window is then scored out of sample. Three folds are used by the CI runner with at least five calibration origins before the first fold.

The evaluator reports:
- per-fold calibration sample size and validation sample size;
- the scale factor estimated without future-origin leakage;
- in-sample calibration coverage;
- out-of-sample validation coverage;
- pooled validation coverage weighted by validation sample size;
- the range and mean of fold-specific scale factors.

No production factor is changed by this research implementation.

## Interpretation

The historical model-1 audit shows the nominal interval under-covered its intended 90% target in the prior sample. The single 70/30 split improved some horizons but was not uniformly stable across the held-out period. The multi-fold evaluator is therefore the next validation layer before any production calibration decision.

Model-2 is kept separate because its point-estimate path, gate and uncertainty behavior differ from model-1.

## Next decision gate

Before changing production interval width:
1. inspect the three temporal validation folds on the current data;
2. check stability of factors across folds and horizons;
3. examine coverage by horizon and sample-density regime;
4. compare against the current uncalibrated band;
5. only then consider a production change, with a regression fixture and CI artifact retaining the evidence.


## Current three-fold calibration result

On the current 240-record dataset, the CI runner used three expanding temporal validation folds, with each fold's scale factor estimated only from earlier origins.

| Horizon | Validation n | Pooled validation coverage | Min factor | Mean factor | Max factor |
|---:|---:|---:|---:|---:|---:|
| 1 day | 336 | 91.37% | 1.2672 | 1.3761 | 1.5083 |
| 3 days | 322 | 90.37% | 1.1700 | 1.1860 | 1.1970 |
| 7 days | 286 | 91.96% | 1.3368 | 1.4003 | 1.4730 |
| 14 days | 144 | 92.36% | 1.2241 | 1.5798 | 1.8220 |

Fold-by-fold validation coverage was:
- 1 day: 92.86%, 91.96%, 89.29%.
- 3 days: 88.89%, 93.52%, 88.68%.
- 7 days: 86.46%, 97.92%, 91.49%.
- 14 days: 93.75%, 100.00%, 83.33%.

The factors vary materially for 1-, 7-, and especially 14-day horizons, while 3-day factors are comparatively close. This is evidence for retaining horizon-specific research factors rather than collapsing them into one constant.

These measurements still do not justify changing the production band automatically: the validation is based on historical origins, and coverage should also be examined by poll-density regime and across additional temporal periods.
