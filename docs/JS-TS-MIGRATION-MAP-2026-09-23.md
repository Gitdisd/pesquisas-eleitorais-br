## 2026-09-25 20:48:03 -03:00 / 2026-09-25T23:48:03Z — Methodology cutover candidate rebased to current production

- The methodology Rust/Dioxus component is applied on the current main@059a394b0334cff08fd8db2f1541e6d4e26d4224 base for fresh exact-head validation.
- src/methodology.js remains protected; removal stays gated on execution-graph and deployed verification.

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

## 2026-09-25 03:06:26 -03:00 / 2026-09-25T06:06:26Z — CI #370 ownership correction

- CI #370 reached Rust tests, Python tests, real-data backtest, canonical estimator equivalence, advanced backtest and fieldwork-overlap audit successfully.
- The run then failed at the Rust/Dioxus web compile because `App` had made its `view` signal immutable while existing button handlers still require `view.write()`; restored on branch commit `b1980b6bd1943f061a37d9b42fe1ec35236ecb20`.
- Browser smoke `run #43` passed the legacy Chromium job while the Dioxus Chromium job was still compiling the pinned Dioxus CLI at documentation time.
- No production cutover or JS/TS deletion is authorized by this failed run.

## 2026-09-25 02:34:02 -03:00 / 2026-09-25T05:34:02Z — Native SVG navigation + Dioxus production bundle

- Step 5 now covers hover inspection, bounded pan, wheel zoom, two-pointer pinch zoom and recenter navigation in the parallel UI.
- Added dedicated Dioxus desktop/mobile browser smoke coverage and a pinned Dioxus 0.7.10 bundle check.
- GitHub Pages deployment now publishes the Rust/Dioxus bundle plus the repaired data mirrors; the legacy Vite build is validation-only.
- Temporary compiler diagnostics were removed after the compile-gate investigation.
- Production cutover remains gated on the latest CI/browser results; no legacy JS/TS/ECharts file is certified removable.
- Progressive research verified Dioxus 0.7.10 pointer and wheel APIs and the documented Pages base-path/public artifact flow.

- Next interaction slice researched and scoped: Dioxus 0.7 native mouse events provide element-relative coordinates suitable for a custom SVG crosshair; zoom/pan remains a separate follow-on slice.\n- CI #348: **failed** at the Rust/Dioxus web UI gate on merge ref `da07af8d8a57dd69989447d7b4b6e40c177e2a1d`; the projection-v2 helper existed in `chart.rs` but its import was omitted from `app.rs`. Fixed in the next branch commit.\n## CI validation history

- CI #346: **failed** at Rust unit tests for head `dd4d692eb49a11a8e0cade8ed17b962819c94e55`; the new projection-v2 boundary derived `Serialize` for `ProjectionV2Result` without deriving it on shared `ProjectPoint`. Corrected on the next branch commit; later CI gates were not reached.
- CI #346 failed at Rust unit tests on head `dd4d692eb49a11a8e0cade8ed17b962819c94e55` before WASM, browser or parity gates. The failure was a missing `Serialize` derive on shared `ProjectPoint`; the correction is recorded in the next commit. No legacy JS/TS module is certified removable.
- CI #342: **failed** at the Rust/Dioxus web compile gate on the PR merge ref for head `032c7e2e1f389b1f9d744f0368d57c706131328e`; Rust/Python/backtest/parity checks passed, then the web compile failed because `gloo_timers` was still imported after dependency removal and `row.candidates` was moved before borrowing `row`. Corrected in `c3e5f8db75b872487f276df8b2cfee2bfd9315a9`; no production path changed.
- CI #341: failed at the Rust/Dioxus compile gate on 381edb1e30db613f2bd7ae4e7839a8ba22ee4737 for three mechanical issues introduced by the published+extra/refresh slice: missing root re-exports for IdentityFields/tse_protocol_of, a Poll test initializer missing its required id, and gloo_timers::Interval being returned directly from Dioxus use_hook even though use_hook requires a Clone state. Corrected in the following commit; no production path was changed.

# Browser JS/TS migration map — 2026-09-23

## Audit timestamp
- UTC: 2026-09-23T04:46:06Z
- America/Sao_Paulo: 2026-09-23T01:46:06-03:00
- Branch: `migration-rust-ui-2026-09-23`

This is a migration map, not deletion authorization. A current browser module remains protected until its references are audited, its responsibility is replaced, numerical behavior is checked where applicable, desktop/mobile behavior is validated, the replacement is included in the production build and the deployed replacement is verified.

## Browser/application inventory

| Path | Responsibility | Rust/Dioxus destination | Status |
|---|---|---|---|
| `index.html` | production shell/bootstrap | `rust/web-ui/index.html` + Dioxus | parallel replacement |
| `src/main.js` | boot, data store, cards/table, controls, refresh | Dioxus app/state | parallel Rust loader/refresh covers published+extra data and 60s refresh; cards/table/legacy DOM state remains |
| `src/chart.js` | chart rendering, points, aggregate, uncertainty, navigation | custom Rust/SVG | Rust/Dioxus custom chart now includes the model-2 projection-v2 overlay; production ECharts caller remains |
| `src/aggregate.js` | TS aggregate compatibility re-export | Rust aggregate | protected |
| `src/aggregate.ts` | weighted trends, uncertainty, model dispatch | Rust statistics | weightedTrendV1/weightedTrendV2/uncertainty/model-2 primitives moved to shared Rust core; model dispatch remains |
| `src/projection.js` | projection UI/math | Rust projection + Dioxus | base projection math migrated to Rust; UI/copy integration remains |
| `src/projection-v2.js` | projection-v2 | Rust projection + Dioxus | Rust process-noise selection, holdout gate and projection-v2 core exposed through WASM; Dioxus model-2 surface consumes the Rust core; direct parity is in CI #346; production caller remains |
| `src/candidates.js` | candidate registry/aliases/scenario parsing | Rust canonical data layer | partial |
| `src/data/api.ts` | JSON loading | Rust data client | parallel loader fetches published + extra bundles with cache-busting refresh nonce; extra remains soft-failing |
| `src/data/identity.js` | canonical identity/TSE/geo keys | Rust identity | protocol-note recovery and identity description migrated; production JS caller remains |
| `src/data/normalize.ts` | raw→normalized/merge | Rust normalization | parallel loader ports canonical/fallback merge, candidate de-duplication, metadata merge, and candidate/round normalization; broader parity remains |
| `src/data/types.ts` | TypeScript contracts | Rust structs/contracts | Rust parallel `Poll` contract now preserves parsed MOE; broader normalization/merge parity remains |
| `src/models/advanced.ts` | models 3–7 | Rust statistical models | Rust implementations 3–7 migrated to shared core; direct WASM↔production parity harness passes; Dioxus dispatcher now exposes models 3–7; production dispatcher remains |
| `src/models/school.ts` | models 8–12 | Rust statistical models | Rust school-center implementations 8–12 migrated to shared core; direct WASM↔production parity harness passes for 8–12; Dioxus dispatcher now exposes models 8–12; production dispatcher remains |
| `src/stats/contract.js` | canonical weighting contract | `rust/polling-core` | Rust sample/recency weighting and weightedTrendV1 exist; callers remain |
| `src/stats/estimator.js` | JS estimator compatibility path | Rust/WASM estimator | partial |
| `src/stats/house-effects.js` | house-effect calculation | Rust statistics | Rust equivalent exists; production callers remain |
| `src/stats/wasm-estimator.js` | JS WASM adapter | Rust/Dioxus boundary | not migrated |
| `src/overlays.js` | chart overlays/projection/uncertainty | Rust/SVG components | not migrated |
| `src/live-overlay.js` | live status/data overlay | Dioxus components | not migrated |
| `src/regional-panel.js` | regional chart/table/isolation | Dioxus regional view | not migrated |
| `src/site-controls.js` | site controls/share/filter state | Dioxus state/router | not migrated |
| `src/theme-layout.js` | theme/layout behavior | Dioxus + CSS | not migrated |
| `src/ui-refresh.js` | dashboard refresh layer | Dioxus components | not migrated |
| `src/ui-next.js` | share URLs and CSV/JSON export | Rust/Dioxus export layer | not migrated |
| `src/ui-upgrades.js` | UI enhancement hooks | Dioxus components | not migrated |
| `src/methodology.js` | methodology/diagnostic UI | `rust/web-ui/src/methodology.rs` | migrated in parallel; legacy protected |
| `src/echarts-runtime.js` | ECharts runtime loading | removed from final architecture | protected until last caller disappears |
| `src/e2e-hooks.js` | browser smoke hooks | Dioxus/browser test instrumentation | not migrated |
| `vite.config.js` | Vite production build | Dioxus/static build | protected until cutover |

## CSS coupling

The old CSS files are also protected until their old DOM dependencies disappear:
`src/style.css`, `src/crt-theme.css`, `src/layout-fix.css`, `src/methodology.css`, `src/party-themes.css`, and `src/ui-refresh.css`.

The Rust/Dioxus slice has independent styling in `rust/web-ui/assets/style.css`.

## Node pipeline boundary

`scripts/*.mjs` are acquisition, refresh, recovery, audit, publication and research tooling. They are not browser UI modules. The browser migration does not authorize their deletion. Any later Node→Python/Rust pipeline migration requires its own execution-graph audit and timestamped decision.

## Migration order

1. Canonical data contracts and identity.
2. Canonical aggregation/uncertainty.
3. Projection and models.
4. Dioxus state/layout/data refresh.
5. Custom SVG crosshair, bounded pan, pinch zoom, wheel zoom and range navigation — implemented in the parallel UI and covered by browser smoke.
6. Regional/methodology/diagnostic surfaces.
7. Share/export/theme/accessibility/performance parity.
8. Production build and Pages cutover — Dioxus artifact path configured; pending successful pre-merge CI/browser gates.
9. Repository-wide browser JS/TS execution-graph certification.
10. Remove Vite/ECharts/legacy browser modules only after deployed replacement verification.

## Current status

Production remains on the legacy path until PR #40 clears all cutover gates. Apache ECharts is not part of the target architecture. PR #40 now contains the production Dioxus bundle path, but legacy modules remain protected.

Latest validation sequence:
- CI #307: Rust/Dioxus compile failed on initial RSX syntax.
- CI #310: superseded/cancelled while the first correction was being refined.
- CI #312: found the remaining RSX loop-binding syntax issue.
- CI #314: found one duplicated `#[test]` attribute in the newly shared core.
- CI #315: previous validation target before the latest corrections; historical result retained.
- CI #317: **failed** on Dioxus RSX point-loop syntax.
- CI #318: **cancelled** after the subsequent correction superseded it.
- CI #319: **failed** on intentionally unused migration-schema fields and the public Dioxus component name `App`; these are source warnings elevated to errors by `-D warnings`.
- CI #333: **failed** during Rust core tests on `identity::tests::protocol_can_be_recovered_from_methodology_note`: the newly added regression fixture asserted `separado de produto`, which the production `src/data/identity.js` does not exclude. The fixture was corrected to the actual production exclusion pattern before the projection-v2 slice.
- CI #335: **failed** at the Rust/Dioxus web compile gate because `rust/web-ui/src/chart.rs` had lost its `Poll` import and retained an obsolete `poll_weight` import. This is a source-continuity correction; no chart or statistical formula was changed.
- CI #337: **failed** in Rust core tests on `advanced_models::tests::school_models_preserve_institute_collapse_semantics`: the model-8 fixture expectation was incorrect (model 8 averages institute-collapsed values equally, yielding 45.5 for 41 and 50). The implementation passed the other advanced-model tests; the fixture is corrected before further migration work.
- No existing JS/TS production module is certified removable.
- Canonical `weightedTrendV1` now has a shared Rust implementation and the Rust/Dioxus chart delegates to it.
- CI #342 is the latest completed validation recorded here for the pre-fix merge ref. Its two Rust/Dioxus compile errors are corrected on branch head `c3e5f8db75b872487f276df8b2cfee2bfd9315a9`; no validation run for that new head was available at documentation time. The old JS/TS implementation remains protected until numerical parity and production cutover gates pass.
- No production cutover or live-site behavior change has occurred.

The validation record is intentionally kept chronological so failures and corrections remain auditable rather than being rewritten away.
