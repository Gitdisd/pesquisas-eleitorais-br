## 2026-09-25 04:55:30 -03:00 / 2026-09-25T07:55:30Z — Methodology surface migration

- Added `rust/web-ui/src/methodology.rs` and mounted `MethodologySection` in the Rust/Dioxus application.
- Preserved the methodology text, model descriptions, examples and formulas; added an explicit `aria-labelledby` relationship to the section heading.
- Ported the associated styling into the Rust/Dioxus stylesheet.
- Legacy `src/methodology.js` and `src/methodology.css` remain protected and are not deleted by this slice.

## 2026-09-25 04:31:00 -03:00 / 2026-09-25T07:31:00Z — Correct release-bundle artifact assertion

- CI #380 showed `dx bundle --web --release --debug-symbols false` successfully compiling and copying the web bundle, then failed because the repository workflow incorrectly required `dioxus-ci/public/wasm`.
- Dioxus 0.7 release web assets are registered under `public/assets`; the validation now checks that directory and verifies that at least one `.wasm` file exists there. The Pages workflow received the same correction.
- Native Dioxus and legacy Chromium browser smoke both passed on the preceding exact head. This commit contains no application/statistical changes.

## 2026-09-25 04:12:00 -03:00 / 2026-09-25T07:12:00Z — Harden Dioxus release bundle and native SVG hover smoke

- Dioxus v0.7 documents `--debug-symbols` for release bundles; CI, browser smoke and Pages deployment now pass `--debug-symbols false` explicitly, because the prior config-only setting still allowed the bundled Binaryen `wasm-opt` path to abort on DWARF metadata. citeturn766812search1turn524014search0
- Native SVG hover smoke now verifies that the crosshair `<line>` exists and has matching X coordinates instead of requiring Playwright to classify a zero-width SVG line as CSS-visible. Tooltip visibility remains asserted.
- The application interaction behavior is unchanged.

## 2026-09-25 04:02:00 -03:00 / 2026-09-25T07:02:00Z — Dioxus wasm-opt and smoke-server correction

- CI #376 failed at `wasm-opt` with `compile unit size was incorrect`; release wasm optimization now explicitly disables retained debug symbols in `rust/web-ui/Dioxus.toml`.
- Browser smoke #49 failed because the Playwright config is located under `tests/e2e/`; the Python server now uses the correct repo-root-relative artifact path and verifies `index.html` before the test starts.
- These are validation/infrastructure fixes only; application logic and poll/statistical calculations are unchanged.

## 2026-09-25 03:32:00 -03:00 / 2026-09-25T06:32:00Z — Pinned Dioxus CLI binary in CI/deploy

- Dioxus 0.7 documentation recommends prebuilt CLI binaries and notes that source installation can take up to 10 minutes; the migration workflows now install the exact v0.7.10 Linux x86_64 release asset by URL plus SHA-256 verification.
- Updated CI, browser smoke and Pages deployment workflows without changing application code or statistical behavior.
- This change is intended to remove the repeated source-build bottleneck from migration validation while keeping the CLI version deterministic.

## 2026-09-25 03:06:26 -03:00 / 2026-09-25T06:06:26Z — Rust/Dioxus ownership correction

- CI #370 confirmed the statistical and data-validation gates through overlap audit, then stopped at Rust/Dioxus compilation because the top-level `App` signal binding must be mutable for existing control handlers. The fix is isolated to state binding; chart math, projection math and interaction logic are unchanged.
- Chromium legacy browser smoke passed; Dioxus browser smoke remained in progress at this timestamp.
- Production cutover remains blocked until a single current SHA passes the full CI and Dioxus browser gates.

# Architecture migration: Rust + Dioxus + custom SVG + Python

## 2026-09-25 02:34:02 -03:00 / 2026-09-25T05:34:02Z — Dioxus production-bundle gate

- Native SVG hover, bounded pan, wheel zoom and two-pointer pinch zoom are implemented in the replacement UI.
- CI/browser validation now bundles the Rust/Dioxus web app with Dioxus CLI 0.7.10.
- GitHub Pages will publish that Dioxus bundle with repaired public/data mirrors; the legacy Vite build remains validation-only during the transition.
- No legacy browser module has been deleted or certified removable. Production cutover is pending successful current gates.


This document is the authoritative migration record. Historical implementation details are preserved below instead of being rewritten.

## Final target architecture

- **Rust + Dioxus 0.7.10:** public application/UI layer, state, controls, accessibility semantics, layout, and browser interaction.
- **Custom Rust/SVG:** polling chart rendering and interaction primitives. No Apache ECharts, Chart.js, or replacement chart library.
- **Rust/WASM:** validated production statistical primitives that need to execute in the browser.
- **Python:** research, reproducible backtests, calibration diagnostics, data-quality analysis, and offline statistical development.
- **GitHub Pages:** static publication target unless a later architecture decision records a change.

Dioxus is being used because its web renderer is WASM-based, renders DOM/HTML/SVG, supports Rust event handlers and is documented for static GitHub Pages deployment. The web build may contain generated JavaScript/bootstrap code required to start WebAssembly in a browser; that generated build output is not authored application source.

## No-authored-JS/TS requirement

The completed repository application must contain **zero hand-authored JavaScript or TypeScript browser application modules**.

This requirement does not prohibit generated loader/runtime files produced by the WebAssembly toolchain. The source-of-truth UI, behavior, state, chart rendering, and browser logic must live in Rust.

Production JS/TS files are migration dependencies until their responsibilities have been replaced and validated. They must not be deleted simply because a parallel Rust file exists.

## Migration gates

A replacement progresses only after the preceding gate passes:

1. Rust unit tests and numerical fixture tests.
2. WASM compilation for the web target.
3. Rust/Dioxus browser smoke on desktop and mobile.
4. Numerical parity against the canonical estimator and relevant research fixtures.
5. Static build and GitHub Pages deployment validation.
6. Repository-wide execution-graph certification for every file being removed.
7. Removal of Vite/browser JS/TS/chart-library dependencies only after the replacement is active on the deployed site.

The current production application remains the reference implementation until the relevant gate is passed.

## Current migration state — 2026-09-23

At migration start, production was Vite + hand-authored JavaScript/TypeScript + Apache ECharts. Seven JavaScript entrypoints were loaded by the historical HTML shell, and package.json still depended on ECharts.

This migration pass creates a parallel Rust/Dioxus application under rust/web-ui. It is **not yet the production site**.

The current parallel migration slice provides:

- Rust/Dioxus application shell.
- Published poll JSON loading.
- Rust normalization and candidate matching.
- First/second-round selection.
- Geography filtering.
- Range filtering.
- Canonical sample/recency weighted trend calculation by calling the existing Rust statistical core.
- Custom SVG chart with date and percentage axes and individual poll points.
- Native SVG point titles for source/date/value inspection.
- Accessible chart role and label.
- Inspection table.
- Shared Rust base projection and projection-v2 core, including the production holdout gate, with a direct WASM↔production parity gate now wired.
- Shared Rust advanced-model core for models 3–12, with direct WASM↔production parity; the parallel Dioxus UI exposes models 1–12 and preserves poll MOE inputs needed by models 3, 4 and 7. Model 2 now also renders the migrated Rust projection-v2 line/band and holdout status. The parallel UI remains non-production until browser/deployment gates pass.

Not yet migrated in this slice:

- background refresh/check timers;
- URL/share-state synchronization;
- institute filtering controls;
- Full Dioxus projection controls/copy integration; the model-2 projection surface is now wired, while the legacy production projection caller remains protected;
- advanced models 3–12 are now in the shared Rust core with deterministic regression coverage; model 2 house-effect correction is already wired into the Rust UI;
- regional/national dual-panel composition;
- custom range slider;
- regional/methodology/diagnostic surfaces; methodology text is now rendered by Rust/Dioxus while the regional and diagnostic surfaces remain separate;
- complete accessibility and mobile regression suite.

These are tracked migration work, not deleted functionality.

## Timestamp and change logging

Every migration change is recorded in three places:

- exact UTC timestamp;
- corresponding America/Sao_Paulo timestamp;
- changelog entry in the same commit.

Historical changelog entries are never rewritten. New entries are inserted at the top.

Migration start timestamp for this slice:

- UTC: **2026-09-23T04:35:01Z**
- America/Sao_Paulo: **2026-09-23 01:35:01 -03:00**

## Deletion certification

The repository cleanup standard remains mandatory.

Before deleting a JS/TS/chart-library file, record evidence for:

- HTML/browser entry references;
- source imports and dynamic imports;
- package/build references;
- CI/workflow references;
- test references;
- public asset references;
- documentation/runtime references;
- replacement coverage and validation;
- live/deployed execution evidence when applicable.

No migration deletion is certified by filename similarity, size, age, or the presence of a replacement file alone.

## Historical intermediate migration

The previous architecture document described a Python + Rust/WASM + Apache ECharts migration. That work is retained as historical implementation evidence:

- Chart.js was replaced by ECharts.
- Python research tooling was scaffolded.
- Rust/WASM statistical primitives and parity checks were added.
- ECharts browser regression coverage was built.
- Production aggregation remained dependent on JS/TS compatibility code.

That architecture is now frozen as an intermediate state and will be removed only through the gated replacement process above.

## Relationship to existing research validation

The statistical research results already completed are not silently changed by the renderer migration. Existing production constants, canonical weighting behavior, projection behavior, and interval semantics remain reference behavior until any numerical replacement passes the parity/research gates.

## Current migration status

**Phase A — Rust/Dioxus replacement: cutover gate configured; awaiting successful CI/browser deployment validation**

Branch: migration-rust-ui-2026-09-23

No production cutover has occurred in this phase.
