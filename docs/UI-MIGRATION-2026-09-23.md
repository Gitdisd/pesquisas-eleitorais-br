# UI migration record — 2026-09-23

## Decision timestamp

- UTC: 2026-09-23T04:35:01Z
- America/Sao_Paulo: 2026-09-23 01:35:01 -03:00

## Decision

The repository historical ECharts migration is now classified as an intermediate implementation, not the final UI architecture.

The target public application is:

- Rust + Dioxus 0.7.10 for the application/UI layer.
- Custom Rust/SVG rendering for the polling chart; no Apache ECharts, Chart.js, or replacement chart-library dependency.
- Rust/WASM for validated browser-side statistical primitives.
- Python for research, reproducible backtests, calibration diagnostics, data QA, and offline statistical development.
- GitHub Pages remains the static publication target unless a later documented decision changes it.

The repository has no prior committed choice of a specific Rust UI framework before this decision. This selection is therefore recorded as a new architecture decision rather than presented as historical fact.

## Zero-authored-JS/TS rule

The completed migration target is zero hand-authored JavaScript/TypeScript application source.

The browser still has to execute WebAssembly through browser tooling, and Dioxus web builds may contain generated JavaScript/bootstrap/runtime code. Such generated artifacts are build output and are not treated as authored application code. The repository final application source must contain no .js, .mjs, or .ts browser UI modules.

Migration code may coexist with the existing frontend temporarily. No current production JS/TS file may be deleted until its responsibility has a tested Rust replacement and the replacement has passed the applicable runtime/deployment gate.

## Current baseline at migration start

At the start of this migration pass:

- index.html directly loaded seven JavaScript entrypoints.
- The production browser application was Vite + JavaScript/TypeScript + Apache ECharts.
- package.json still depended on echarts; vite.config.js still controlled the browser build.
- Rust already contained a validated statistical core (rust/polling-core).
- Python already contained the research/backtest layer.
- The current production application and its browser/Pages validation chain are intentionally frozen while the replacement is built in parallel.

## First migration slice

Created under rust/web-ui/:

- rust/web-ui/Cargo.toml — Dioxus 0.7.10 web application crate.
- rust/web-ui/Dioxus.toml — static web app configuration and GitHub Pages base path.
- rust/web-ui/index.html — authored HTML shell with no JavaScript.
- rust/web-ui/assets/style.css — UI styling.
- rust/web-ui/src/main.rs — Rust entrypoint.
- rust/web-ui/src/app.rs — Rust/Dioxus application, controls, table, and page composition.
- rust/web-ui/src/data.rs — Rust JSON loading, poll normalization, candidate matching and filters.
- rust/web-ui/src/chart.rs — canonical Rust-weighted trend plus SVG coordinate/rendering primitives.

This slice deliberately does not replace the production deployment. It is a parallel replacement implementation and the current production JS/TS/ECharts application remains the reference behavior until parity is demonstrated.

## Validation gates

A production replacement may advance only in this order:

1. Rust unit tests for parsing, identity/candidate mapping, filtering and chart math.
2. cargo check for the WebAssembly target of the Dioxus web crate.
3. Browser smoke on the Rust-rendered application, including desktop/mobile, data loading, chart rendering, controls, accessible labels, and table.
4. Numerical parity against the canonical production estimator/backtest fixtures.
5. Build/deployment validation on GitHub Pages.
6. Only then: remove the replaced Vite/JS/TS/ECharts production path after a repository-wide execution-graph certification.

No deletion is allowed merely because a file appears redundant. The existing repository cleanup standard remains in force: prove the file is outside browser/build/workflow/code/public-asset execution paths, and prove its replacement is active.

## Timestamp/logging rule

Every migration step must produce:

- an exact UTC timestamp in its migration record;
- an America/Sao_Paulo timestamp for human auditability;
- a changelog entry on the same commit;
- the commit SHA recorded in this document after creation;
- validation results recorded before a production-switch decision.

Historical changelog entries are never rewritten. New migration entries are prepended.

## Current migration status

Started — parallel replacement only.

The first Rust/Dioxus implementation exists, but no production cutover has occurred and no existing JS/TS/ECharts production file is certified removable by this slice.
