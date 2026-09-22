# Advanced models 3–12 rolling-origin backtest — 2026-09-22

## Purpose

This report evaluates the existing production TypeScript implementations of models 3–12 against the current polling data. It is a historical diagnostic, not an election forecast, and it does not select or promote a production model.

The evaluator calls the production averageTrend dispatcher directly, so the research path does not recreate the model formulas separately.

## Current dataset

- 240 raw poll records.
- 44 scenario/candidate series.
- 27,930 scored model-horizon observations across models 3–12.
- CI run: 35676056704.
- Retained artifact: advanced-backtest-50769d702ea99b32e47c2c539b7eca03f056e8cd.
- Artifact digest: sha256:e7475607df375e03bae1511312aa708b191c8014a116c72834663da79b29566d.

## Protocol

Each origin is date-safe: only observations on or before the origin are visible to the model. The prediction is the latest production trend estimate at or before that origin. The future target is the first available observation date at or after the nominal 1-, 3-, 7-, or 14-day horizon, provided it is inside the 14-day evaluation cap. Persistence is the date-level mean on the origin date. Sparse-target lag is retained explicitly.

## Aggregate diagnostics

Models are listed by their existing IDs, not ranked.

| Model | Horizon | n | MAE | RMSE | Bias | Persistence MAE | Persistence RMSE |
|---|---:|---:|---:|---:|---:|---:|---:|
| 3 — random effects | 1d | 848 | 1.7629 | 2.5605 | -0.0520 | 2.3753 | 3.3242 |
| 3 — random effects | 3d | 815 | 1.7567 | 2.5652 | -0.0714 | 2.3570 | 3.3611 |
| 3 — random effects | 7d | 738 | 1.7845 | 2.6125 | -0.0601 | 2.3827 | 3.4520 |
| 3 — random effects | 14d | 392 | 1.8947 | 2.7367 | -0.0541 | 2.4258 | 3.7115 |
| 4 — Kalman | 1d | 848 | 1.7664 | 2.5658 | -0.1302 | 2.3753 | 3.3242 |
| 4 — Kalman | 3d | 815 | 1.7632 | 2.5623 | -0.1515 | 2.3570 | 3.3611 |
| 4 — Kalman | 7d | 738 | 1.7997 | 2.6331 | -0.1390 | 2.3827 | 3.4520 |
| 4 — Kalman | 14d | 392 | 1.8460 | 2.6952 | -0.1274 | 2.4258 | 3.7115 |
| 5 — punch/recency | 1d | 848 | 2.0693 | 2.9034 | -0.0212 | 2.3753 | 3.3242 |
| 5 — punch/recency | 3d | 815 | 2.0959 | 2.9832 | -0.0536 | 2.3570 | 3.3611 |
| 5 — punch/recency | 7d | 738 | 2.1070 | 3.0503 | -0.0452 | 2.3827 | 3.4520 |
| 5 — punch/recency | 14d | 392 | 2.1469 | 3.2315 | -0.0481 | 2.4258 | 3.7115 |
| 6 — institute de-duplication | 1d | 848 | 2.4146 | 3.5047 | -0.0101 | 2.3753 | 3.3242 |
| 6 — institute de-duplication | 3d | 815 | 2.3206 | 3.2881 | -0.0403 | 2.3570 | 3.3611 |
| 6 — institute de-duplication | 7d | 738 | 2.5161 | 3.5730 | -0.0356 | 2.3827 | 3.4520 |
| 6 — institute de-duplication | 14d | 392 | 2.5341 | 3.6444 | -0.0004 | 2.4258 | 3.7115 |
| 7 — local linear | 1d | 848 | 2.1355 | 3.0024 | -0.0201 | 2.3753 | 3.3242 |
| 7 — local linear | 3d | 815 | 2.1794 | 3.0957 | -0.0523 | 2.3570 | 3.3611 |
| 7 — local linear | 7d | 738 | 2.1507 | 3.1003 | -0.0420 | 2.3827 | 3.4520 |
| 7 — local linear | 14d | 392 | 2.2041 | 3.3073 | -0.0479 | 2.4258 | 3.7115 |
| 8 — school mean | 1d | 848 | 1.8592 | 2.7039 | -0.0495 | 2.3753 | 3.3242 |
| 8 — school mean | 3d | 815 | 1.8787 | 2.6901 | -0.0691 | 2.3570 | 3.3611 |
| 8 — school mean | 7d | 738 | 1.9223 | 2.8166 | -0.0583 | 2.3827 | 3.4520 |
| 8 — school mean | 14d | 392 | 1.9546 | 2.8409 | -0.0510 | 2.4258 | 3.7115 |
| 9 — school weight | 1d | 848 | 1.8949 | 2.7414 | -0.0381 | 2.3753 | 3.3242 |
| 9 — school weight | 3d | 815 | 1.9121 | 2.7170 | -0.0599 | 2.3570 | 3.3611 |
| 9 — school weight | 7d | 738 | 1.9607 | 2.8712 | -0.0505 | 2.3827 | 3.4520 |
| 9 — school weight | 14d | 392 | 1.9575 | 2.8448 | -0.0367 | 2.4258 | 3.7115 |
| 10 — school median | 1d | 848 | 1.8492 | 2.7481 | -0.1029 | 2.3753 | 3.3242 |
| 10 — school median | 3d | 815 | 1.8610 | 2.6837 | -0.1208 | 2.3570 | 3.3611 |
| 10 — school median | 7d | 738 | 1.9294 | 2.8079 | -0.1035 | 2.3827 | 3.4520 |
| 10 — school median | 14d | 392 | 1.9340 | 2.8105 | -0.1090 | 2.4258 | 3.7115 |
| 11 — school mode | 1d | 848 | 1.9513 | 2.8773 | -0.1905 | 2.3753 | 3.3242 |
| 11 — school mode | 3d | 815 | 1.9219 | 2.8229 | -0.2155 | 2.3570 | 3.3611 |
| 11 — school mode | 7d | 738 | 2.0459 | 2.9905 | -0.2122 | 2.3827 | 3.4520 |
| 11 — school mode | 14d | 392 | 2.0514 | 2.9868 | -0.1643 | 2.4258 | 3.7115 |
| 12 — school trimmed | 1d | 848 | 1.8249 | 2.6894 | -0.0922 | 2.3753 | 3.3242 |
| 12 — school trimmed | 3d | 815 | 1.8334 | 2.6539 | -0.1122 | 2.3570 | 3.3611 |
| 12 — school trimmed | 7d | 738 | 1.8918 | 2.7627 | -0.0961 | 2.3827 | 3.4520 |
| 12 — school trimmed | 14d | 392 | 1.9139 | 2.8019 | -0.0987 | 2.4258 | 3.7115 |

## Interpretation

These are descriptive historical diagnostics for the current dataset and scoring protocol. They show that model families differ in error and bias, but the differences do not by themselves justify a general production-model decision. The next validation layer should use temporal folds, subgroup stability, poll-density sensitivity, institute-mix sensitivity and model-specific uncertainty behavior.

No production model was changed because of this report.
