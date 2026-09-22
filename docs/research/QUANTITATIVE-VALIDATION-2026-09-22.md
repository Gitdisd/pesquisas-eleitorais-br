# Quantitative research validation — 2026-09-22

This document records the reproducible research extensions added while finishing the statistical validation backlog. Production behavior is unchanged unless a validation gate below is explicitly passed.

## 1. Tracking / overlapping fieldwork

The repository already detects overlapping fieldwork windows. The new research layer treats overlap as evidence of possible dependence, not proof of a shared respondent panel.

For a poll, each overlapping same-institute + same-scenario + same-geography peer contributes an overlap fraction based on the number of overlapping fieldwork days relative to the shorter fieldwork window. A sensitivity parameter rho in {0, 0.10, 0.25, 0.50, 0.75} converts that exposure into a variance-inflation-style divisor:

    design_effect = 1 + rho * sum(overlap_fraction)

The research evaluator compares rho values under date-safe rolling-origin backtesting at 1-, 3-, and 7-day horizons. rho=0 is exactly the existing independent-weight baseline. No positive rho is used in production without stable out-of-sample improvement.

This is intentionally a sensitivity framework rather than an assertion that overlapping fieldwork means a common panel. Survey methodology literature treats dependence/clustering as a source of design-effect inflation, while election-poll aggregation literature also warns that polls can contain correlated errors and persistent house effects.

## 2. First-round composition

A research-only simplex-safe benchmark uses six consistently observed first-round components:

- Lula
- Flávio Bolsonaro
- Augusto Cury
- Renan Santos
- Ronaldo Caiado
- Romeu Zema

Only complete-case polls containing all six are used. The remaining share is represented explicitly as a residual component. The joint benchmark forecasts additive log-ratios against that residual and maps the forecast back to the simplex, guaranteeing non-negative shares summing to 100%.

The benchmark is compared with an independently weighted-and-renormalized baseline under rolling-origin validation. This is not presented as a full multinomial state-space production model; it is a falsifiable composition benchmark intended to determine whether the simplex constraint itself produces enough predictive improvement to justify a more elaborate model.

## 3. Uncertainty coverage by sample density

The canonical weighted rolling-origin backtest now records the number of observations available in the preceding 14 days for each origin. Interval calibration is performed on the first 70% of temporal origins and evaluated on the later 30%, separately by low/medium/high density strata and forecast horizon.

This avoids using late-origin errors to calibrate the intervals that are then used to evaluate those same late origins.

## 4. Browser semantics

The Chromium regression suite now verifies:

- the six audited regional releases appear in the regional table;
- their ECharts point metadata preserves fieldwork-end dates and TSE registrations;
- the time x-axis is actually a time axis;
- observed-only right padding remains <= 2 days;
- pointer movement over a chart date produces the external date/value inspection box.

Desktop and Pixel-5-sized mobile Chromium remain separate test projects.

## 5. Source-level regional re-audit

The regional additions were checked against published source pages before insertion. The site keeps these rows outside the national aggregate.

## External methodological references

- AAPOR disclosure standards emphasize disclosure of data-collection dates, sample sizes, precision, and design-effect adjustments where relevant: https://aapor.org/standards-and-ethics/disclosure-standards/
- Forecasting: Principles and Practice describes rolling-origin evaluation as a leakage-safe time-series validation approach: https://otexts.com/fpptr/tscv.html
- Forecasting: Principles and Practice describes prediction intervals as coverage statements whose calibration depends on the forecast error distribution: https://otexts.com/fpp3/prediction-intervals.html
- Linzer-style election aggregation explicitly models correlated polling errors in state/national election forecasting: https://pkremp.github.io/
- Public polling aggregation methodology also notes persistent house effects and the need to account for them when aggregating repeated polls: https://www.natesilver.net/p/silver-bulletin-polling-average-methodology

## Validation status

The exact numerical outputs are stored in the CI polling-backtest artifact for the validated revision. Production constants are not changed by these research extensions.


## Measured results from CI run #286

Validated revision: `8f8f4916704d4714d7e71ee44dbc100ec86986e1`.

### Canonical weighted estimator

Across 1-, 3-, and 7-day rolling-origin evaluations:

| Horizon | N | MAE | RMSE |
|---|---:|---:|---:|
| 1 day | 364 | 1.990 | 2.612 |
| 3 days | 358 | 1.869 | 2.499 |
| 7 days | 342 | 2.014 | 2.684 |

Persistence was worse at every reported horizon (MAE 2.723, 2.615 and 2.671 respectively).

The retrospective empirical 90% error quantiles were 4.222, 3.847 and 4.731 percentage points for 1-, 3- and 7-day horizons. These values are useful calibration diagnostics but are not treated as prospective production coverage.

### Tracking-correlation sensitivity

The current canonical dataset contains only two overlapping fieldwork pairs under the implemented same-institute + same-scenario + same-geography definition.

Across the tested rho grid (0, 0.10, 0.25, 0.50, 0.75), aggregate MAE was effectively unchanged. At 3 and 7 days, increasing rho consistently moved error slightly upward; the largest tested rho therefore does not justify production adoption. The project keeps rho=0 in production.

This result is also a data-identification result: the current metadata does not establish shared respondent panels, so overlap is treated as a possible-dependence signal rather than a factual panel identifier.

### First-round composition benchmark

N=95 complete-case first-round polls were available for the six-component benchmark.

The joint additive-log-ratio benchmark was materially worse than the independently weighted + renormalized baseline:

| Horizon | Joint ALR MAE | Independent-renormalized MAE |
|---|---:|---:|
| 1 day | 5.658 | 1.653 |
| 3 days | 5.936 | 1.660 |
| 7 days | 6.096 | 1.529 |

Both approaches were simplex-safe. The joint ALR benchmark is therefore retained as research code but is not promoted into the production estimator.

### Projection-v2 interval calibration

Raw projection-v2 nominal coverage was 88.1%, 91.7%, 89.1% and 87.6% at 1, 3, 7 and 14 days respectively.

Temporal 70/30 holdout calibration produced scale factors 0.989, 0.971, 0.994 and 1.033, with validation coverage 84.7%, 90.0%, 87.7% and 90.2%. The dispersion across horizons is too large to justify changing production constants on this run alone. Production projection behavior therefore remains unchanged.

### Sample-density interval calibration

In the held-out density audit, high-density validation coverage was 86.5% at 1 day, 81.1% at 3 days and 89.8% at 7 days. Medium-density validation had only 8 observations per reported horizon and is not sufficient to support a production rule. No qualifying low-density validation stratum was available.

The result supports keeping the production band explicitly described as estimated/uncalibrated rather than labeling it a guaranteed 90% interval.

### CI / browser evidence

CI #286 passed all repository validation steps through the final integrity checks.

The earlier browser regression found and fixed a genuine regional TSE-metadata-loss bug. The later x-axis test failure was corrected as a test assumption: explicit viewport bounds can start after an earlier hidden/filtered observation. The browser suite still needs a fresh successful run against this exact final revision before the corresponding live-site task is marked complete.
