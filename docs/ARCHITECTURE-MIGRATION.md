# Architecture migration: Python + Rust + ECharts

This repository is migrating toward a three-layer architecture while keeping GitHub Pages as the public static host.

## Target architecture

- Python: research, reproducible model development, rolling-origin backtests, calibration, data-quality analysis, and pipeline experimentation.
- Rust/WASM: deterministic performance-sensitive statistical primitives that are safe to execute in the browser.
- ECharts: public visualization and interaction layer.
- Vite: browser build and static asset bundling.
- GitHub Pages: deployment target.

The languages are complementary rather than competing. Python does not need to render the public chart, and Rust does not need to own the UI.

## Migration rule

The migration is incremental. Existing production statistical behavior is not silently replaced by an unvalidated new estimator.

### Phase 1
1. Replace Chart.js with ECharts while preserving pan/zoom/range navigation.
2. Establish Python statistical research package and tests.
3. Establish Rust/WASM statistical core and tests.
4. Keep the existing JS/TS estimator as the compatibility implementation.

### Phase 2
1. Define the canonical PollObservation/PollWeight contract.
2. Reimplement one estimator in Python and Rust.
3. Generate golden fixtures from the existing implementation.
4. Compare outputs numerically before switching production execution.
5. Move only validated primitives into WASM.

### Phase 3
1. Move production aggregation onto the validated statistical core.
2. Add rolling-origin backtests and interval-coverage checks.
3. Remove duplicated legacy statistical primitives only after equivalence is demonstrated.

## Non-negotiables

- Preserve TradingView-style chart maneuverability.
- Preserve observed-poll visibility and date-centric inspection.
- Do not present uncalibrated model envelopes as calibrated intervals.
- Do not silently change polling methodology during renderer migration.
- Keep Python research code out of the browser bundle.
- Keep Rust's browser boundary small and explicit.

## Current status

- ECharts renderer: migrated.
- Python research package: scaffolded with core weighting primitive.
- Rust/WASM core: scaffolded with matching sample-size and weighting primitive.
- Canonical observation/weight contract: established in JS, Python, and Rust with a shared golden fixture.
- Production aggregation: now consumes the shared JS contract for sample-size/recency weighting.
- Canonical estimator interface: now defined in JS and Python with a real-data golden fixture.
- Legacy advanced estimators: still retained pending numerical validation against Python/Rust; model families 3–12 are still awaiting the comparable rolling-origin evaluation.
- Legacy aggregation: retained as compatibility path pending numerical validation.
- Estimator bounds remain unset until rolling-origin interval calibration is completed.
- Rolling-origin backtesting: date-safe harness added with persistence and canonical-weighted baselines at 1/3/7-day horizons; same-day polls no longer impose an arbitrary within-day ordering.
- House-effect estimation: consolidated into `src/stats/house-effects.js` and reused by aggregate, advanced model 4, and projection-v2 without changing the existing formula.
- Real-data backtest input: reproducible loader added for `data/polls.json`, grouped by scenario and candidate; current corrected runs use unique origin dates and date-level actual/persistence means to avoid arbitrary same-day ordering. Metrics are research evidence only and are not yet promoted to model-selection decisions.
- Projection-v2 rolling-origin evaluator: added under `python/pebr_stats/projection_v2_backtest.py`; CI now records gate availability and conditional out-of-sample metrics without changing production projection behavior.
- Migration task register: tracked in GitHub issue #14.

- Advanced model research: production models 3–12 now have a direct date-safe rolling-origin evaluator at scripts/run_advanced_backtest.mjs, with retained CI artifact diagnostics; no production model switch has been made.
- Projection interval research: expanding three-fold calibration is implemented at python/pebr_stats/multifold_projection_calibration.py and reported in the CI backtest artifact; production interval width remains unchanged.
- Data state: the canonical dataset contains 240 records through publication date 2026-09-21, with zero duplicate fallback identities in the current audit.
