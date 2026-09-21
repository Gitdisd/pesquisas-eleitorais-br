# GPT CHECK — Polling Chart Deep-Dive Checklist

> Working checklist for the bottom polling chart and its surrounding statistical/interaction architecture.
>
> **Important design requirement:** preserve the TradingView-style maneuverability. Pan, zoom, range navigation, crosshair/date-centric inspection, and smooth exploration are desirable product behavior. The goal is to make the underlying statistical model and chart architecture correct **without removing that interaction model**.

## 0. Scope and acceptance criteria
- [ ] Treat the bottom chart as a complete system: data ingestion → normalization → aggregation → uncertainty → projection → overlays → ECharts rendering → interaction → responsive/accessibility behavior.
- [ ] Keep TradingView-style navigation as a first-class requirement, not an experimental feature.
- [ ] Separate statistical correctness from visual/interaction convenience.
- [ ] Avoid patching symptoms where a shared model contract is missing.
- [ ] Add regression tests for every production bug fixed.
- [ ] Run build, tests, lint/type checks, and deployment validation after changes.
- [ ] Document intentional methodological choices rather than implying they are universally correct.

## 1. Immediate production bugs
### 1.1 Automatic refresh crash — CRITICAL
- [x] Inspect src/main.js refresh path.
- [x] Replace undefined normalize(nextRaw) with the actual imported normalizePolls(nextRaw) if the current code still matches the diagnosed bug.
- [ ] Add a regression test exercising the hourly/background refresh path.
- [ ] Verify refresh failure cannot silently leave stale chart state.

### 1.2 Round-2 y-axis contradiction — CRITICAL
- [x] Inspect yScaleForRound() and round-2 candidate keys.
- [x] Confirm whether branco_nulo is intentionally displayed.
- [x] If displayed, ensure its values are never clipped by a minimum y-axis of 30.
- [x] Prefer a dynamic scale based on visible data or an explicitly designed principal-candidates mode.
- [ ] Test round 2 with low-value series such as branco/nulo.

## 2. Canonical statistical model contract
- [ ] Define one authoritative PollObservation structure: poll identity, institute, fieldwork start/end, publication date, sample size, margin of error, geography, round/scenario, candidate/result shares, tracking/overlap metadata.
- [ ] Define one authoritative PollWeight structure.
- [ ] Centralize sample-size handling.
- [ ] Enforce the documented sample-size cap consistently (currently 4,000 where that cap is intended).
- [ ] Centralize recency weighting.
- [ ] Centralize flood/duplicate/tracking handling.
- [ ] Centralize house-effect estimation.
- [ ] Remove or reconcile duplicate house-effect implementations across aggregate.ts, projection-v2.js, and models/advanced.ts.
- [ ] Ensure every model uses the same sample-size convention unless explicitly documented otherwise.

## 3. Aggregation/model architecture
- [ ] Trace every weightedTrendV1–V7 implementation and every averageTrendAdvanced model number.
- [ ] Verify that UI-selected model numbers actually reach the intended runtime implementation.
- [x] Resolve model-selector drift where models 6–12 may fall back to model 1.
- [ ] Define a single estimator interface returning date, candidate/result key, central estimate, lower bound, upper bound, and effective sample size/information metric.
- [ ] Decide explicitly whether candidate series are independently estimated or constrained as a composition.
- [ ] If independent estimation is retained, document that candidate curves need not sum to exactly 100%.
- [ ] If composition is desired, evaluate a compositional/log-ratio or softmax-based model rather than ad-hoc rescaling.

## 4. Uncertainty
- [ ] Inspect the exact uncertaintyBand() implementation.
- [ ] Verify that the uncertainty band corresponds to the estimator actually shown.
- [ ] Distinguish poll sampling error, between-poll heterogeneity, house effects, temporal/model uncertainty, and forecast uncertainty.
- [ ] Avoid presenting a hand-built RMSE/process-SD envelope as a calibrated confidence/credible interval unless calibration has been demonstrated.
- [ ] Prefer simulation/bootstrap/posterior intervals where practical.
- [ ] Backtest interval coverage, not only point-estimate RMSE.
- [ ] Label model-derived envelopes accurately if they are not calibrated intervals.

## 5. Tracking polls and overlapping fieldwork
- [ ] Inspect current flood/overlap correction.
- [ ] Determine whether overlapping tracking polls are being treated as correlated observations.
- [ ] Compare current handling with explicit overlap-aware methods used by established polling aggregators.
- [ ] Avoid double-counting repeated tracking observations merely because they have distinct poll IDs.
- [ ] Add tests for overlapping tracking series.

## 6. Projection/forecast layer
- [ ] Inspect projection-v2.js and projection.js as separate systems.
- [ ] Unify or clearly separate projection responsibilities.
- [ ] Fix inconsistent sample-size weighting/capping in projection-v2.
- [ ] Replace the single last-7-days holdout gate with rolling-origin backtesting across multiple historical cutoffs/horizons where data volume permits.
- [ ] Compare against simple baselines such as persistence and EWMA.
- [ ] Evaluate state-space/Kalman/local-regression alternatives.
- [ ] Calibrate projection intervals empirically.
- [ ] Keep forecast visually distinct from observed polling and current aggregate.
- [ ] Do not let projection logic silently alter the observed historical series.

## 7. Chart architecture
- [ ] Keep the primary public chart and research/model-lab capabilities conceptually separate.
- [ ] Preserve the interactive/trading-style chart experience.
- [ ] Use semantic dataset roles: poll, aggregate, uncertainty, projection, overlay.
- [x] Stop relying on dataset-label regexes to determine behavior.
- [x] Make tooltip logic branch on semantic role.
- [x] Make visibility/toggling branch on semantic role.
- [ ] Keep observed polls visually distinguishable from modeled curves.

## 8. TradingView-style interaction — PRESERVE AND IMPROVE
- [ ] Preserve pan/zoom/range navigation.
- [ ] Preserve mouse/touch navigation.
- [ ] Preserve useful zoom levels over the full polling history.
- [ ] Avoid an unnecessary fixed right-side blank area.
- [ ] Keep cross-date inspection fast.
- [ ] Prefer date-centric interaction (mode index, intersect false, axis x) where it improves multi-series inspection.
- [ ] Consider a proper crosshair plugin/implementation if useful.
- [ ] Support reset/home view.
- [ ] Consider range presets: All, 90 days, 30 days, Election period, Custom.
- [ ] Ensure zooming does not break y-axis readability.
- [ ] Ensure tooltips remain useful while zoomed deeply.
- [ ] Ensure touch gestures do not conflict with page scrolling.
- [x] Keep interaction state stable when datasets refresh.
- [x] Preserve the user's viewport when new polls arrive unless there is a strong reason to recenter.
- [ ] Test interaction after automatic data refresh.
- [ ] Test mobile and desktop separately.

## 9. X-axis semantics
- [ ] Decide whether the chart represents opinion at fieldwork end or information availability at publication date.
- [ ] Document that choice.
- [ ] Consider an explicit user toggle if both interpretations are useful.
- [ ] Ensure fieldwork dates and publication dates are not silently mixed.

## 10. Right-side whitespace
- [ ] Review RIGHT_PAD_DAYS = 18.
- [ ] Do not reserve an 18-day blank area when projection is disabled.
- [ ] Use a small visual margin for observed-only mode.
- [ ] When projection is enabled, reserve only the projection horizon plus a small margin.
- [ ] Verify this remains correct under zoom/pan/reset.

## 11. Technical overlays
- [ ] Review SMA7, SMA21, EMA9, EMA21, HMA16, VWMA14, KAMA10, Bollinger20.
- [ ] Decide whether these belong in the public chart at all.
- [ ] If retained, place them in an explicitly labeled research/experimental layer.
- [ ] Do not visually imply that trading indicators are polling uncertainty measures.
- [ ] Reconsider VWMA: raw sample size is not literal trading volume.
- [ ] If VWMA-like weighting is retained, document its statistical interpretation rather than calling it volume in the trading sense.

## 12. ECharts data/performance
- [ ] Verify whether data are sorted and unique by internal index.
- [x] Use ECharts time-series data in sorted chronological order.
- [ ] Evaluate ECharts progressive rendering/large-data options only where they materially help.
- [ ] Prefer domain-aware downsampling for statistical curves if generic decimation would distort important polling changes.
- [ ] Ensure canvas rendering remains smooth on mobile with the full history.
- [x] Preserve dataZoom inside interaction and the visible range slider.
- [ ] Test large tooltip payloads and many visible datasets.

## 13. Tooltip/data inspection
- [ ] Audit custom external tooltip code.
- [ ] Replace fragile label-based classification with semantic roles.
- [ ] Show date clearly.
- [ ] Show poll/model distinction clearly.
- [ ] Show institute/sample size/fieldwork metadata where relevant.
- [ ] Ensure aggregate and projection values cannot be mistaken for individual polls.
- [ ] Ensure uncertainty bounds are interpretable.
- [ ] Ensure tooltip works while zoomed and panned.

## 14. Responsive layout
- [ ] Review .chart-box height constraints.
- [ ] Verify whether 42vh / 220–280px is sufficient for all visible series and controls.
- [ ] Test narrow phones, tablets, desktop, and large displays.
- [ ] Ensure resize does not reset zoom unexpectedly.
- [ ] Ensure controls remain reachable without obscuring the chart.
- [ ] Ensure the chart has a dedicated responsive container.

## 15. Accessibility
- [ ] Improve canvas semantics beyond a bare aria-label.
- [ ] Add appropriate role/label relationships.
- [ ] Connect the chart to the underlying polling table/data where practical.
- [ ] Ensure keyboard users can access essential data/controls.
- [ ] Provide a non-canvas data path for important information.
- [ ] Do not rely on color alone to distinguish critical series.

## 16. Statistical visualization hierarchy
- [ ] Define a clear visual hierarchy: observed polls → aggregate estimate → uncertainty → optional projection → optional experimental overlays.
- [ ] Make uncertainty visually subordinate to the central estimate.
- [ ] Keep experimental indicators visually subordinate and clearly labeled.
- [ ] Avoid making every mathematical series look equally authoritative.

## 17. Research/backtesting
- [x] Build a reproducible historical backtest harness.
- [x] Use rolling-origin cutoffs rather than one arbitrary holdout.
- [x] Evaluate multiple horizons.
- [x] Compare simple baselines against sophisticated models.
- [ ] Measure RMSE/MAE and interval coverage where appropriate.
- [ ] Examine performance separately for sparse, dense, tracking-heavy, and different-round periods.
- [ ] Record validated results so model changes are evidence-driven.

## 18. Code quality / maintainability
- [ ] Prefer TypeScript for core statistical contracts where practical.
- [ ] Avoid duplicating statistical primitives in JS and TS.
- [ ] Define constants centrally.
- [ ] Add unit tests around every weighting primitive.
- [ ] Add integration tests around dataset construction.
- [ ] Add regression tests for every discovered production bug.
- [ ] Keep experimental code isolated from production paths.
- [ ] Document assumptions next to the implementation, not only in external prose.

## 19. Deployment validation
- [ ] Run full test suite.
- [ ] Run build.
- [ ] Run lint/type checks where configured.
- [ ] Inspect generated/static assets.
- [ ] Verify GitHub Pages deployment status.
- [ ] Verify the deployed commit matches the intended commit.
- [ ] Check browser-level behavior where available.
- [ ] If browser-level access is unavailable, distinguish deployment confirmation from visual/live-site confirmation.
- [ ] Check for console/runtime errors after deployment when browser tooling permits.

## 20. Final acceptance checklist
- [ ] No known runtime exception in refresh path.
- [ ] No chart series intentionally clipped.
- [ ] Round 1 and round 2 axes correctly represent all visible series.
- [ ] Model selector actually changes the estimator it claims to change.
- [ ] Weighting/capping rules are consistent.
- [ ] Uncertainty corresponds to the displayed estimator and is honestly labeled.
- [ ] Tracking-poll overlap is handled deliberately.
- [ ] Projection is validated independently from the observed aggregate.
- [ ] TradingView-style navigation remains intact.
- [ ] Zoom/pan/reset work on desktop and mobile.
- [ ] Refresh preserves useful viewport state.
- [ ] Tooltips remain coherent at all zoom levels.
- [ ] Experimental overlays cannot be confused with official polling estimates.
- [ ] Accessibility/data fallback is present.
- [ ] Tests/build/deployment checks pass.
- [ ] Documentation reflects the final architecture.

## Research references used during diagnosis
- FiveThirtyEight polling-average methodology: https://fivethirtyeight.com/methodology/how-our-polling-averages-work/
- FiveThirtyEight uncertainty/tracking example: https://fivethirtyeight.com/features/how-were-tracking-joe-bidens-approval-rating/
- FiveThirtyEight polling-average redesign: https://fivethirtyeight.com/features/introducing-our-brand-new-polling-averages/
- The Economist methodology: https://projects.economist.com/us-2020-forecast/president/how-this-works
- Apache ECharts documentation: https://echarts.apache.org/en/index.html
- Apache ECharts dataZoom: https://echarts.apache.org/en/option.html#dataZoom
- Apache ECharts axisPointer: https://echarts.apache.org/en/option.html#axisPointer
- Brazilian polling aggregator examples: https://depoisdas17.com.br/, https://agregadordepesquisas.com.br/, https://noticias.uol.com.br/eleicoes/agregador-de-pesquisas-eleitorais/

## Product requirement captured from user
**Do not fix the chart by removing its TradingView-like maneuverability.** The ability to maneuver through the historical polling data is explicitly valued. Any refactor should preserve or improve pan, zoom, range navigation, cross-date inspection, touch interaction, viewport persistence through data refresh, reset/home navigation, and smooth performance.