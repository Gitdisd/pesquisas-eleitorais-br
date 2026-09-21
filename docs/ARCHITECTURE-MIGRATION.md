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
- Legacy aggregation: retained as compatibility path pending numerical validation.
