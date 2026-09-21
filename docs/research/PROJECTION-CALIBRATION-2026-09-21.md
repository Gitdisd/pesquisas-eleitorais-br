[object Object]

## Model 2 / projection-v2 audit

The separate model-2 path was evaluated with its own house-effect, flood and holdout-gate logic rather than inheriting model-1 assumptions.

| Horizon | n | Nominal interval coverage | Median half-width |
|---:|---:|---:|---:|
| 1 day | 197 | 88.32% | 3.9579 pp |
| 3 days | 189 | 91.01% | 3.9681 pp |
| 7 days | 170 | 88.82% | 3.9848 pp |

Across the historical origins where model 2 was eligible, its internal holdout gate passed all 200 eligible origins in this evaluation. The 14-day result is not yet included because the available eligible target set is too thin for the same quality of inference.

This reinforces the rule that interval calibration must be **model-specific**. Model 1 showed clear under-coverage; model 2 does not show the same degree of under-dispersion in the current sample.
