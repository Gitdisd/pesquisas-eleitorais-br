# Changelog

## 2026-09-24T15:09:44Z / 2026-09-24 12:09:44 -03:00 — Projection-v2 WASM boundary + parity gate

- Added a typed Rust/WASM boundary for the already-migrated Rust projection-v2 core.
- Extended the existing parity script to compare the legacy `projectTrendV2` result with Rust line/bands, holdout metrics, slope, RMSE and horizon on a deterministic fixture.
- No production UI or deployment path changed in this commit; the legacy JavaScript projection remains the reference until the new parity gate passes.
- Progressive research before implementation: verified the current `serde-wasm-bindgen` 0.6.5 native Serde↔JavaScript conversion pattern.
- Files: `rust/polling-core/src/projection_v2.rs`, `rust/polling-core/src/lib.rs`, `scripts/check-wasm-parity.mjs`.

# Changelog

## 2026-09-24 12:00:59 -03:00 / 2026-09-24T15:00:59Z — CI #342 refresh-gate correction

- Recorded CI #342 as a failed validation against the PR merge ref; Rust tests, Python tests, rolling backtests, parity and source checks passed before the Rust/Dioxus web compile gate stopped the job.
- CI #342 reported two compile errors introduced by the preceding refresh correction: `gloo_timers::callback::Interval` remained imported after its dependency was removed, and the `row.candidates` loop moved the vector before `identity_fields(&row)` borrowed the containing row.
- Restored the existing `gloo-timers 0.4.0` dependency and changed the candidate loop to borrow the slice, preserving the 60-second refresh behavior and data transformation rules.
- No production Vite/JavaScript/TypeScript path, statistical formula, chart geometry, deployment path or Apache ECharts path changed.
- Files: `rust/web-ui/Cargo.toml`, `rust/web-ui/src/data.rs`.

## 2026-09-23T22:28:14-03:00 / 2026-09-24T01:28:14Z — Dioxus refresh compile-gate correction

- CI #341 exposed three compile-only continuity issues in the published+extra/refresh slice.
- Re-exported IdentityFields and tse_protocol_of from the shared polling-core root so the Rust loader can consume the migrated identity API.
- Restored the required id field in the affected Poll initializer.
- Retained the non-cloneable gloo-timers::Interval inside a cloneable Rc when storing it with Dioxus use_hook, matching the framework hook contract without changing the 60-second refresh behavior.
- No statistical formula, data merge rule, chart geometry, production Vite/JavaScript/TypeScript path or Apache ECharts path changed.
- Files: rust/polling-core/src/lib.rs, rust/web-ui/src/data.rs, rust/web-ui/src/app.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23T22:23:17-03:00 / 2026-09-24T01:23:17Z — Rust published+extra merge and 60s refresh

- Ported the production raw-data merge semantics into the parallel Rust loader: canonical TSE identity first, unique fallback matching only, candidate de-duplication, verified/source/methodology merge, geography normalization and earliest valid publication metadata.
- The Rust loader now fetches both `public/data/polls.json` and `public/data/polls-extra.json`; the extra bundle remains soft-failing like production and both requests receive a refresh nonce.
- Added a 60-second Dioxus refresh interval backed by `gloo-timers` and `use_resource`. Refreshing changes the data request nonce but does not rewrite candidate, round, range, geography or model signals.
- Added deterministic tests for candidate de-duplication and canonical identity of a unique supplement.
- Progressive research before implementation: verified the current Dioxus 0.7 resource/signal behavior and current `gloo-timers` 0.4 timer API.
- No production Vite/JavaScript/TypeScript/Apache ECharts path was removed or switched.
- Files: rust/web-ui/Cargo.toml, rust/web-ui/src/data.rs, rust/web-ui/src/app.rs, docs/ARCHITECTURE-MIGRATION.md, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.
## 2026-09-23T22:19:21-03:00 / 2026-09-24T01:19:21Z — Dioxus model dispatcher 1–12 + MOE preservation

- Connected the parallel Rust/Dioxus chart to the shared Rust dispatcher for models 1–12 using the existing short labels: Exp, Casa, Meta, Kalman, Rápido, Dia, Local, Média, Peso, Mediana, Moda and Corta.
- Preserved parsed poll margin-of-error values in the Rust `Poll` contract and forwarded them into `PollObservation`; this prevents models 3, 4 and 7 from silently losing production MOE inputs.
- The integration follows the direct WASM↔production parity gate from CI #339; models 3–12 passed numerical parity before the Dioxus selector was expanded.
- No production Vite/JavaScript/TypeScript/Apache ECharts path was removed or switched. The migration UI remains non-production.
- Files: rust/web-ui/src/data.rs, rust/web-ui/src/chart.rs, rust/web-ui/src/app.rs, docs/ARCHITECTURE-MIGRATION.md, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.
## 2026-09-23T22:10:57-03:00 / 2026-09-24T01:10:57Z — Direct WASM parity gate for models 3–12

- Exposed the migrated Rust advanced-model dispatcher through the WASM boundary and made `SeriesPoint` serializable for browser parity checks.
- Extended `scripts/check-wasm-parity.mjs` to compare the production `averageTrendAdvanced` implementation against Rust/WASM for every model 3–12 on a deterministic fixture containing multiple institutes, sample sizes, MOEs and date gaps.
- The existing canonical estimator parity check remains intact in the same gate.
- This validates numerical output before advanced models are connected to the Dioxus UI; no production model selection, Vite path, JavaScript/TypeScript module, or Apache ECharts path was changed.
- Files: rust/polling-core/src/aggregation.rs, rust/polling-core/src/lib.rs, scripts/check-wasm-parity.mjs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.
## 2026-09-23T22:07:26-03:00 / 2026-09-24T01:07:26Z — Advanced-model regression test correction

- CI #337 found one incorrect expected value in the new Rust regression fixture: production model 8 performs a simple mean over institute-collapsed values, so 41 and 50 produce 45.5; model 9 remains the weighted 44.0 result.
- Corrected that test expectation without changing the model implementation.
- CI #337 also exposed that the preceding advanced-model commit's tree construction had reintroduced the older Dioxus chart imports; the chart import state from CI #336 is restored here.
- No production Vite/JavaScript/TypeScript/Apache ECharts path was removed or switched.
- Files: rust/polling-core/src/advanced_models.rs, rust/web-ui/src/chart.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.
## 2026-09-23T22:05:04-03:00 / 2026-09-24T01:05:04Z — Advanced models 3–12 moved into shared Rust core

- Ported the production statistical implementations for models 3–12 from `src/models/advanced.ts` and `src/models/school.ts` into `rust/polling-core/src/advanced_models.rs`.
- Preserved model-specific behavior: model 3 DerSimonian–Laird random-effects variance, model 4 house-effect-corrected forward/backward smoother, model 5 punch/recency weighting, model 6 institute de-duplication, model 7 local-linear tricube regression, and school-center reducers for models 8–12.
- Added deterministic tests for poll standard-error semantics, random-effects variance capping, constant-series preservation, institute-collapse behavior and local-linear endpoint recovery.
- The existing advanced-model rolling backtest remains the research reference; no model has been selected, promoted or substituted in production by this migration slice.
- No production Vite/JavaScript/TypeScript/Apache ECharts path was removed or switched.
- Files: rust/polling-core/src/advanced_models.rs, rust/polling-core/src/lib.rs, docs/ARCHITECTURE-MIGRATION.md, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.
## 2026-09-23T22:01:46-03:00 / 2026-09-24T01:01:46Z — Dioxus chart import continuity correction

- CI #335 reached the Rust/Dioxus WebAssembly compile stage and found that rust/web-ui/src/chart.rs was missing the Poll type import while still importing unused poll_weight.
- Restored the required crate::data::Poll import and removed only the unused compatibility import.
- No chart geometry, statistical formula, production path or published data changed.
- The projection-v2 migration remains non-production and the old JS/TS/ECharts path remains protected.
- Files: rust/web-ui/src/chart.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.
## 2026-09-23T21:59:15-03:00 / 2026-09-24T00:59:15Z — Projection-v2 core migrated with holdout gate

- Ported the production projection-v2 process-noise selection, seven-day holdout gate, house-effect correction and final projection orchestration into the shared Rust core.
- Preserved an important production detail: the debiased observations passed to weightedTrendV2 omit institute identity, so no second institute/day flood divisor is applied after house correction.
- Added deterministic tests for process-noise thresholds, holdout-vs-persistence gating and model-2 result shape.
- Audited the election-date constants against the production projection module and the current TSE calendar before this migration slice; the Rust values now use the same UTC markers as production.
- No production Vite/JavaScript/TypeScript/Apache ECharts path was removed or switched; the JavaScript projection-v2 module remains protected until its caller/UI and deployment gates are migrated.
- Files: rust/polling-core/src/projection_v2.rs, rust/polling-core/src/lib.rs, rust/polling-core/src/aggregation.rs, docs/ARCHITECTURE-MIGRATION.md, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.
## 2026-09-23T21:57:04-03:00 / 2026-09-24T00:57:04Z — Migration gate correction: identity fixture and projection dates

- CI #333 exposed a Rust identity-parity test fixture that asserted behavior not present in the production `src/data/identity.js`; the fixture now uses the same documented exclusion pattern as production.
- Audited the Rust projection election-day constants against the production `src/projection.js` and the current TSE calendar. Corrected the Rust constants to the production `12:00:00Z` markers for 4 October 2026 and 25 October 2026.
- The TSE calendar confirms the 2026 first-round date as 4 October and the eventual second-round date as 25 October; the migration preserves the existing application's UTC marker rather than changing its projection convention.
- No production Vite/JavaScript/TypeScript/Apache ECharts path was removed or switched.
- Files: rust/polling-core/src/identity.rs, rust/polling-core/src/projection.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.
## 2026-09-23 13:31:09 -03:00 / 2026-09-23T16:31:09Z — Poll identity parity completed in Rust core

- Added Rust parity for the JavaScript identity module's methodology-note protocol recovery, including exclusion of explicitly separate products/waves and rejection of ambiguous multiple protocols.
- Added the canonical identity-description formatter used to explain protocol-based versus fallback identity.
- Added regression tests for note extraction, ambiguity handling and fallback description shape.
- Added the `regex` dependency only to the Rust polling core for this parity slice.
- The JavaScript identity module remains protected until its downstream production callers are migrated and deletion certification passes.
- Files: rust/polling-core/Cargo.toml, rust/polling-core/src/identity.rs, rust/polling-core/src/lib.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 13:29:31 -03:00 / 2026-09-23T16:29:31Z — Rust UI model-2 import correction

- CI #330 identified two concrete import issues in the model-2 integration: `Poll` was missing from `chart.rs`, while the obsolete `poll_weight` import remained.
- Restored the `Poll` type import, added the model-2 wrapper when absent from the current head, and removed the stale import.
- No statistical formula or production path was changed.
- Updated the migration map and changelog for the observed CI failure.
- Files: rust/web-ui/src/chart.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 13:27:51 -03:00 / 2026-09-23T16:27:51Z — Rust UI model-2 integration

- Connected the new Rust/Dioxus UI to the migrated institute house-effect estimator and `weightedTrendV2` implementation.
- Added a model selector with the existing model-1 canonical path and model-2 house-effect-corrected path.
- Preserved the production model-2 sequence: estimate house effects, debias observations, then apply weightedTrendV2.
- Updated the migration map to record that the migrated Rust functions now have an active replacement UI caller.
- No production Vite/JavaScript/TypeScript/Apache ECharts path was removed or switched.
- Files: rust/web-ui/src/app.rs, rust/web-ui/src/chart.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 13:26:31 -03:00 / 2026-09-23T16:26:31Z — Explicit staging lints for pending Rust migration APIs

- CI #328 correctly stopped on three migration-stage `dead_code` lints: the newly ported `weighted_trend_v2` has no Rust UI caller yet, and the base projection election-date constants are not yet consumed by the replacement UI.
- Marked only those specific pending APIs with `#[allow(dead_code)]`; no repository-wide warning suppression was added.
- Recorded the failure in the migration map so the validation history remains chronological.
- Production remains unchanged.
- Files: rust/polling-core/src/aggregation.rs, rust/polling-core/src/projection.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 13:25:11 -03:00 / 2026-09-23T16:25:11Z — Rust UI consumes migrated uncertainty band

- Wired the Rust/Dioxus SVG chart to the shared Rust uncertainty-band primitive and renders the resulting bounds as an SVG polygon.
- Preserved the current semantics: estimated aggregate uncertainty, not a survey margin of error and not calibrated coverage.
- No production Vite/JavaScript/TypeScript/Apache ECharts path was removed or switched.
- Updated the migration map and changelog together with the code change.
- Files: rust/web-ui/src/app.rs, rust/web-ui/assets/style.css, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 13:24:01 -03:00 / 2026-09-23T16:24:01Z — Rust uncertainty export correction

- CI #325 identified an export wiring error introduced during the uncertainty migration: `uncertainty_band` and `UncertaintyPoint` were implemented in the shared core root but incorrectly reexported from `aggregation`.
- Corrected only the public export path; the uncertainty implementation itself is unchanged.
- Recorded CI #325's concrete failure in the migration map before the next validation.
- Files: rust/polling-core/src/lib.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 13:23:00 -03:00 / 2026-09-23T16:23:00Z — WeightedTrendV2 escape correction before validation

- Static inspection of the newly added Rust flood-index implementation found the separator encoded as a literal `\\u{0000}` rather than Rust's intended null-character escape.
- Corrected the key separator before the CI gate so the Rust implementation matches the production key structure.
- No production code path was changed or removed.
- Updated the migration map to record this pre-validation correction.
- Files: rust/polling-core/src/aggregation.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 13:22:09 -03:00 / 2026-09-23T16:22:09Z — WeightedTrendV2 moved into shared Rust core

- Added the Rust equivalent of the production `weightedTrendV2`, including the same institute/day flood index, 2.5 × half-life reach, canonical poll weighting, nearest-point gate and two-decimal rounding.
- Added a regression test proving the institute flood divisor changes relative institute influence while preserving the canonical weighting contract.
- Updated the migration map; the JS model dispatcher remains protected until model-2 integration and numerical parity are completed.
- No production Vite/JavaScript/TypeScript/Apache ECharts path was removed or switched.
- Files: rust/polling-core/src/aggregation.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 13:21:20 -03:00 / 2026-09-23T16:21:20Z — Base projection math moved into shared Rust core

- Added the Rust implementation of the existing base projection model: fit-window clamp, minimum-point gate, election-day horizon cap, bounded slope, damped extrapolation, RMSE calculation and expanding uncertainty band.
- Preserved the existing production defaults and formulas; this is a computational replacement only, not a production model switch.
- Added Rust tests for empty-series behavior, slope capping, current-point preservation and horizon length.
- Updated the migration map. The JavaScript projection module remains protected because UI/copy integration and production cutover are still pending.
- Files: rust/polling-core/src/projection.rs, rust/polling-core/src/lib.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 13:20:34 -03:00 / 2026-09-23T16:20:34Z — House-effect estimator moved into shared Rust core

- Added the Rust equivalent of the existing institute house-effect estimator, preserving peer-window filtering, sample-size weighting, exclusion of same-institute peers, shrinkage and the ±0.05 dead-zone.
- Added deterministic unit tests for missing-institute handling and the symmetric two-institute case.
- The old JavaScript implementation remains active as a protected compatibility caller; no production cutover or deletion is authorized by this slice.
- Updated the migration map and recorded this change in the changelog.
- Files: rust/polling-core/src/house_effects.rs, rust/polling-core/src/lib.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 13:19:44 -03:00 / 2026-09-23T16:19:44Z — Aggregate uncertainty band moved into shared Rust core

- Moved the existing production uncertainty-band formula into `rust/polling-core`, including sample/recency weights, 2.5 × half-life reach, measurement-SE fallback, between-poll variance, effective sample size, minimum band floor and two-decimal bounds.
- Kept the result explicitly as an estimated aggregate uncertainty range; no calibrated-coverage claim or production interval-width change was introduced.
- Updated the migration map to record uncertainty as migrated while model dispatch remains pending.
- No production Vite/JavaScript/TypeScript/Apache ECharts path was removed or switched.
- Files: rust/polling-core/src/lib.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 02:14:22 -03:00 / 2026-09-23T05:14:22Z — Shared Rust aggregation wrapper correction

- CI #321 identified a structural refactor error in `rust/web-ui/src/chart.rs`: the old local `weighted_trend` implementation remained alongside the new shared-core wrapper, while required imports were dropped.
- Removed the duplicate implementation and restored the explicit `poll_weight` import used only by the remaining tests.
- Updated the migration map to preserve the CI failure chronology.
- No production Vite/JavaScript/TypeScript/Apache ECharts path was changed or removed.
- Files: rust/web-ui/src/chart.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 02:09:31 -03:00 / 2026-09-23T05:09:31Z — Dioxus warning-as-error cleanup

- CI #319 reached the Rust/Dioxus WebAssembly crate and failed on three warnings promoted to errors by the repository `-D warnings` policy: unused migration-schema fields in `RawPoll`/`Poll` and the public `App` component's non-snake-case name.
- Marked the intentionally forward-compatible migration data structs as allowed dead code until their pending UI fields are migrated, and explicitly allowed the Dioxus `App` component naming convention.
- No runtime logic, statistical formula, production Vite/JavaScript/TypeScript/Apache ECharts path, or published data was changed.
- Updated the migration map with the verified CI #319 failure state.
- Files: rust/web-ui/src/data.rs, rust/web-ui/src/app.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 02:08:10 -03:00 / 2026-09-23T05:08:10Z — Canonical weighted trend moved into shared Rust core

- Moved the production-equivalent `weightedTrendV1` daily aggregation primitive into `rust/polling-core`.
- Preserved sample-size weighting, exponential recency weighting, 2.5 × half-life reach, nearest-observation gating and two-decimal rounding.
- Changed the migration chart wrapper to adapt `Poll` rows into the shared Rust observation contract instead of reimplementing the aggregation loop locally.
- Added a Rust regression fixture matching the existing migration fixture value; this is a replacement slice, not production cutover or JS/TS deletion authorization.
- Updated the migration map to mark `src/aggregate.ts` as partially migrated.
- Production remains unchanged; no Vite/JavaScript/TypeScript/Apache ECharts production path was removed or switched.
- Files: rust/polling-core/src/aggregation.rs, rust/polling-core/src/lib.rs, rust/web-ui/src/chart.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 02:06:19 -03:00 / 2026-09-23T05:06:19Z — Dioxus point-coordinate precomputation correction

- The prior CI #317 correction still evaluated chart-point coordinates inside the RSX loop expression.
- Restored precomputation before `rsx!` and changed the SVG point loop to consume prepared tuples, satisfying the parser constraint without changing chart math.
- Production remains unchanged; no Vite/JavaScript/TypeScript/Apache ECharts production path was removed or switched.
- Files: rust/web-ui/src/app.rs, docs/CHANGELOG.md.

## 2026-09-23 02:05:19 -03:00 / 2026-09-23T05:05:19Z — Dioxus SVG point-loop compile correction

- CI #317 failed the Dioxus WebAssembly compile gate on two concrete issues: an out-of-scope temporary and a `let` binding inside an RSX loop.
- Removed the unused temporary, restored the chart geometry constants required by the SVG markup, and moved point coordinate calculation into the loop expression without a nested `let` binding.
- Production remains unchanged; no Vite/JavaScript/TypeScript/Apache ECharts production path was removed or switched.
- Files: rust/web-ui/src/app.rs, docs/CHANGELOG.md.

## 2026-09-23 01:58:12 -03:00 / 2026-09-23T04:58:12Z — Dioxus point-coordinate correction

- CI #316 found the remaining RSX restriction: chart-point `let` bindings were still being performed inside the RSX loop.
- Moved point coordinate calculation entirely outside RSX and reduced the chart import set to the symbols actually used.
- No production Vite/JavaScript/TypeScript/ECharts path was changed or removed.
- Files: rust/web-ui/src/app.rs, docs/CHANGELOG.md.

## 2026-09-23 01:54:39 -03:00 / 2026-09-23T04:54:39Z — Migration validation record synchronized

- Updated the browser migration map with the actual CI sequence through the current branch head `a03989e5188bb50774a6b3dd9e19fdadf8827666`.
- Recorded that CI #315 is the current validation run; prior failures remain documented rather than overwritten.
- Production remains unchanged and no JS/TS/ECharts removal has been certified.
- Files: docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 01:53:46 -03:00 / 2026-09-23T04:53:46Z — Rust core test-attribute correction

- Removed the duplicated `#[test]` attribute identified by CI #314 in the shared Rust core.
- No application behavior or production JS/TS/ECharts path was changed.
- Files: rust/polling-core/src/lib.rs, docs/CHANGELOG.md.

## 2026-09-23 01:52:17 -03:00 / 2026-09-23T04:52:17Z — Dioxus RSX axis precomputation

- Moved chart-axis arithmetic out of Dioxus RSX `for` blocks after CI #312 showed that inline arithmetic bindings are rejected by the RSX parser.
- The SVG markup now iterates over precomputed Rust tick tuples, keeping the UI macro declarative while preserving the same chart coordinates and labels.
- No production Vite/JavaScript/TypeScript/ECharts path was changed or removed.
- Files: rust/web-ui/src/app.rs, docs/CHANGELOG.md.

## 2026-09-23 01:47:23 -03:00 / 2026-09-23T04:47:23Z — Rust canonical data-contract slice

- Moved candidate keys/aliases and round recognition into the shared Rust statistical core; the Dioxus loader now imports these primitives instead of carrying its own duplicate implementation.
- Added the first shared Rust poll-identity contract for institute normalization, TSE protocol parsing, canonical/fallback keys, geography and coverage dates.
- Kept identity migration explicitly partial: methodology-note protocol recovery still requires parity validation against the production JavaScript implementation before the old identity module can be retired.
- No production Vite/JavaScript/TypeScript/ECharts path was changed or removed.
- Files: rust/polling-core/src/lib.rs, rust/polling-core/src/candidates.rs, rust/polling-core/src/identity.rs, rust/web-ui/src/data.rs, docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 01:48:40 -03:00 / 2026-09-23T04:48:40Z — Dioxus RSX loop correction

- Replaced unsupported `as f64` conversions inside Dioxus RSX loops with typed `u32` counters and `f64::from`.
- This addresses the remaining compile error reported by CI #310.
- No production Vite/JavaScript/TypeScript/ECharts path was changed or removed.
- Files: rust/web-ui/src/app.rs, docs/CHANGELOG.md.

## 2026-09-23 01:46:06 -03:00 / 2026-09-23T04:46:06Z — Browser JS/TS migration inventory

- Mapped every currently tracked browser-side JavaScript/TypeScript module to its current responsibility, Rust/Dioxus destination and migration status.
- Recorded deletion protection rules requiring execution-graph evidence and validated replacement behavior before any old module is removed.
- Separated browser migration from Node-based acquisition/refresh/audit scripts, which remain protected under their own future migration decision.
- Recorded the migration sequence from data contracts through production cutover and deletion certification.
- Files: docs/JS-TS-MIGRATION-MAP-2026-09-23.md, docs/CHANGELOG.md.

## 2026-09-23 01:44:52 -03:00 / 2026-09-23T04:44:52Z — Rust/Dioxus compile-gate correction

- Fixed the first Rust/Dioxus scaffold compile errors revealed by CI #307: RSX nested-string parsing, numeric conversions inside RSX loops, the poll-row identifier format string, and an unused date-conversion variable.
- No production Vite/JavaScript/TypeScript/ECharts path was changed or removed.
- Files: rust/web-ui/src/app.rs, rust/web-ui/src/data.rs, docs/CHANGELOG.md.
- Validation target: rerun the Rust/Dioxus WebAssembly compile gate before advancing the migration.

## 2026-09-23 01:40:52 -03:00 / 2026-09-23T04:40:52Z — Rust UI canonicalization correction

- Corrected the new Rust/SVG trend scaffold to use the same 2.5 × half-life reach rule as the canonical production weighting path.
- Kept the initial Rust/Dioxus slice non-production; no live Vite/JS/TS/ECharts behavior was changed.
- Files: rust/web-ui/src/chart.rs, rust/web-ui/src/app.rs.

## 2026-09-23 01:35:01 -03:00 / 2026-09-23T04:35:01Z — Rust/Dioxus migration started

- Reclassified the earlier Python + Rust/WASM + Apache ECharts implementation as an intermediate architecture; it is no longer the final UI target.
- Adopted Rust + Dioxus 0.7.10 for the application/UI layer and custom Rust/SVG for chart rendering.
- Added the first parallel Rust web application under rust/web-ui without removing or altering the production Vite/JS/TS/ECharts path.
- The new slice loads the published poll dataset, normalizes candidate/round/geography fields, uses the shared Rust poll-weight primitive, renders a custom SVG trend, and exposes an inspection table.
- Added an explicit no-authored-JS/TS target rule, deletion gates, and timestamp/change-log requirements in docs/UI-MIGRATION-2026-09-23.md and docs/ARCHITECTURE-MIGRATION.md.
- Added CI validation for the Dioxus web crate; production deployment is intentionally unchanged until browser/parity/deployment gates pass.
- Decision basis: Dioxus supports Rust/WASM web applications, DOM/SVG rendering, browser event handlers, and documented GitHub Pages static deployment.

## 2026-09-22 — Repository cleanup certification

- Removed the unused direct `date-fns` dependency from `package.json` and `package-lock.json`; no current application source imports it, while Vite and ECharts remain active dependencies.
- Removed five files proven outside the current browser/build/test/workflow execution graph: `src/fetch-bust.js`, `src/models-advanced.js`, `scripts/repair-source.mjs`, and the obsolete `scripts/run-poll-pipeline.mjs`.
- Removed the empty `docs/deploy-pages.yml.example` workflow placeholder; it contained no executable workflow and had no repository execution reference.
- Removed stale registry-proof path filters for the deleted legacy runner and nonexistent v3 runner; the proof workflow continues to target the active v4 resolver and canonical registry parser.
- Added `docs/REPO-CLEANUP-2026-09-22.md` documenting the evidence standard, retained active components, exact-duplicate data caveat, and future deletion rule.
- Deliberately retained CI-only, manual-maintenance, research, browser-imported compatibility, and published audit files where repository execution or Pages delivery still depends on them.


## 2026-09-22 — Final validation / release closure

- Browser Smoke #19 passed 10/10 across desktop and Pixel-5-sized mobile Chromium on revision `d78b326fb83c1a6276c6f7e009f2d7ed9899e979`, including both charts, the regional poll audit, WASM parity, round-2 low-value series, dataZoom/legend preservation, time-axis bounds and cross-date inspection rendering.
- CI #291 passed on the same revision.
- GitHub Pages deployment #390 succeeded on the same revision after the complete application/statistical validation and Rust/WASM build stages.
- Direct public Pages HTTP/DOM fetching remains unavailable through the current browsing environment, so no independent external-DOM claim is made.
- No production projection constants, correlation factor, or first-round composition model were changed by the research closure; the measured results did not justify replacing the current production behavior.

## 2026-09-22 — Statistical research closure pass

- Added reproducible tracking-correlation sensitivity evaluation across rho = 0, 0.10, 0.25, 0.50 and 0.75; the current dataset has only two qualifying overlapping fieldwork pairs, and positive rho produced no meaningful out-of-sample improvement, so production weighting remains unchanged.
- Added a simplex-safe first-round composition benchmark using additive log-ratios against a residual component; 95 complete-case polls were available, and the joint benchmark materially underperformed the existing independently weighted + renormalized baseline at 1, 3 and 7 days.
- Added temporal 70/30 holdout calibration for projection-v2 intervals and density-stratified empirical interval coverage. Results are recorded without changing production constants because coverage is not uniformly stable by horizon/density regime.
- Added discovery-source health telemetry so each configured source records attempts, successes, failures and recent status evidence; soft-failing sources remain quarantined rather than treated as missing data.
- Added browser regression coverage for regional TSE metadata, time-axis bounds and cross-date inspection.
- CI run #286 passed the full repository validation on revision `8f8f4916704d4714d7e71ee44dbc100ec86986e1`.

## 2026-09-22 — Regional presidential poll source re-audit

- Re-audited the newest regional presidential releases against publication/source evidence and added six verified releases (12 first/second-round rows) for PE, GO, SP, MG and PR to `public/data/polls-regional.json`.
- Preserved fieldwork dates, sample sizes, margins of error, TSE registrations, candidate values and regional-only scope; these rows are excluded from the national aggregate.
- Added browser regression assertions for all six releases, checking both table presence and chart point metadata/fieldwork-end placement.
- Regional dataset now contains 30 rows.
- Preserved TSE registration/protocol metadata when regional rows are normalized for the ECharts layer, so regional chart points retain source identity in hover metadata.

## 2026-09-22 — Refresh → Pages dispatch reconciliation

- Corrected the documented deployment flow so the repository records the explicit `deploy-pages.yml` dispatch performed after a refresh commit.
- This keeps the documentation aligned with the race-safe refresh workflow and avoids relying on a `GITHUB_TOKEN` push to trigger another workflow.
- Current fix commit: `0a12061ffb95b8a89b9295cffcab15e692d75fe8`.

## 2026-09-22 — Full repository audit / production hardening

- Reconciled the retained project conversation records against the current repository, branches, pull requests, workflow history, deployment history, data/discovery artifacts, frontend, statistical engines, Rust/WASM, and GitHub Pages pipeline.
- Fixed dependency-lock drift so the authoritative workflows use `npm ci` successfully.
- Made refresh publication race-safe: refresh commits now rebase onto current `main`, retry a moving remote, and never force-overwrite concurrent changes.
- Preserved national institute filters, regional geography filters, legend visibility, and chart viewport state across background data refresh.
- Made WASM status truthful when the browser uses JS fallback.
- Fixed ECharts-generated regional ARIA descriptions and added desktop/mobile Chromium smoke coverage.
- Replaced the full ECharts import with a shared tree-shaken runtime. Main JS bundle measured ~1,238 kB → ~669 kB minified and ~414 kB → ~225 kB gzip.
- Centralized the Python projection-v2 house-effect implementation onto the canonical sample-size contract.
- Added a durable repository audit documenting completed work versus intentionally open statistical research questions.
- Current canonical dataset at audit time: 240 records; latest publication 2026-09-21; latest fieldwork end 2026-09-20; last successful pipeline 2026-09-22T05:10:36Z.


## 2026-09-22 — Browser WASM adapter

- Added the non-breaking Rust/WASM browser estimator adapter with explicit JS fallback and startup parity smoke reporting.
- CI and GitHub Pages now build the wasm32 package reproducibly and verify generated WASM against the canonical JS estimator before deployment.
- Added a production-estimator equivalence regression check; no production statistical behavior was changed by the WASM migration.

## 2026-09-22 — Advanced-model and interval research

- Added a direct rolling-origin evaluator for production models 3–12 and recorded the current 240-record diagnostics in docs/research/ADVANCED-MODELS-BACKTEST-2026-09-22.md.
- Added expanding three-fold temporal calibration diagnostics for the public model-1 projection interval.
- Recorded current multi-fold validation coverage and factor stability in docs/research/PROJECTION-CALIBRATION-2026-09-21.md.
- These research changes do not select a production model or change production projection constants.

## 2026-09-22 — Projection-v2 research validation

- Added a reproducible rolling-origin evaluator for projection-v2, including the production house-effect correction, weighted trend, holdout gate, sparse-target handling and conditional accuracy/coverage metrics.
- CI backtest artifacts now include projection-v2 gate availability and horizon metrics. No production projection constants were changed.

## 2026-09-21 — House-effect consolidation

- Centralized the existing house-effect formula in `src/stats/house-effects.js` and routed aggregate, advanced model 4, and projection-v2 through the same implementation. The refactor is intended to preserve existing numerical behavior.

## 2026-09-21 — ECharts + statistical validation pass

- **ECharts hardening:** removed the remaining legacy Chart.js reset call, added semantic `seriesRole` filtering, preserved the user's dataZoom viewport across in-place refreshes, and kept observed-only right padding small.
- **Axis/uncertainty semantics:** round-2 bounds remain data-derived; the uncertainty ribbon is now labeled as estimated rather than implying calibrated 90% coverage.
- **Backtesting:** added a reproducible real-data runner and CI artifact, leakage-safe same-day aggregation, and empirical interval-calibration utilities.
- **Projection research:** evaluated the current public projection interval and model-2 path against historical origins; model-1 under-coverage is documented separately from model-2 calibration evidence. No production calibration multiplier has been introduced yet.
- **Conversation audit:** retained the transcript-to-repository gap analysis in `docs/CONVERSATION-AUDIT-2026-09-21.md`.
 
## 2026-09-21 — Conversation audit / migration reconciliation

- Added `docs/CONVERSATION-AUDIT-2026-09-21.md`, mapping the uploaded project transcript to repository implementation and validation state.
- Corrected stale architecture/model documentation after the ECharts migration and canonical weighting change.
- Corrected the rolling-origin research harness so same-day future observations and persistence baselines are aggregated at the date level rather than selected by arbitrary within-day ordering.
- Hardened the ECharts tooltip to use semantic `seriesRole` metadata and preserved the user's dataZoom viewport across in-place refreshes.

## 2026-09-20

- **Documentation synchronization:** updated README, system/acquisition/reasoning/discovery docs and model references to match the current identity module, staged discovery pipeline, TSE queues, hourly refresh, explicit refresh→Pages deployment, N=4,000 weighting cap, uncertainty ribbon, shared `window.__pebr` store, and manual read-only deep-repair workflow.
- **Pipeline repair:** refresh discovery now uses the shared candidate registry and shared canonical identity imports; stale candidate-expansion behavior no longer rewrites source code.
- **Deployment repair:** after a refresh commits changed data with `GITHUB_TOKEN`, the refresh workflow explicitly dispatches the Pages deployment so new data reaches the live site.

## 2026-09-19 — Codex robustness pass

- CI revalidated after failure-remediation; validation now covers every script plus publication integrity gates.
- Unified poll identity around TSE protocol + scenario + geography, with fieldwork fallback; publication date remains coverage metadata.
- Added witness ledger, discovery staging, pending TSE evidence queue, and explicit registry scope queues.
- Hardened publishing against accidental dataset shrinkage and preserved TSE/geo/witness metadata.
- Preserved Chart.js pan/zoom/pinch/Shift-drag state during automatic refresh; regional multi-geo views no longer blend incompatible geographies.
- Added estimated aggregate uncertainty range, N=4,000 sample-weight cap, stable filtered sharing/JSON export, and repository-wide CI gates.
- Removed the unused legacy v3 pipeline and made deep-repair maintenance manual-only to reduce duplicate failure notifications.
- Consolidated the duplicate Palver BR-05420/2026 record using the official Palver wave record (fieldwork 4–7 Sep 2026); retained the alternate publication URL as a witness.

## 2026-09-15

- **Centro pills:** Média, Peso, Mediana, Moda, Corta. School-center stats in the janela. `src/models/school.ts`. Chips styled like a small X Edit-profile pill.
- **Modelos 6 e 7 + nomes curtos nos chips:** Exp, Casa, Meta, Kalman, Rápido, Dia, Local. Dia = média do campo daquele dia. Local = reta LOESS no scatter.
- **Chart range chips:** 1d, 3d, 7d, 14d, 21d added next to 1º/2º turno (keep 30d default). 3d also added to janela da média presets.
- **Merge identity no longer uses published_date.** `scripts/merge-poll-supplements.mjs` keys on institute + fieldwork + scenario. Verified extras can create canonical rows instead of dying as staged-only. Glued residual buckets can be replaced by a witness split (Datafolha branco/nulo 6 + não sabe 4).
- **Added from Gazeta/Estadão 15 Sep:** CNT/MDA 9–13 set BR-06902/2026 (40,5–30,4; 2º 47,3–40) and Indexa/Broadcast 10–13 set BR-03482/2026 (38–34; 2º 43–42) in `data/polls-extra-wave-2026-09-15.json`.
- Existing verified extras (Futura 4–10, GERP 3–8, PoderData 6–9, Veritá 1–4) now promote on merge instead of staying staged-only.
- Unknown shops go to `data/discovery/inbox-new-sources.json`.
- **Campo mais recente** no longer says sem data: `latestDate()` now reads `fieldwork_end` / `published_date` (the JSON keys), not the camelCase aliases it was looking for.

Registro de mudanças reais. Entrada nova no topo. Não reescrever história.

Formato: data (America/Sao_Paulo) · o quê · por que · arquivos.

## 2026-09-14

- **Refresh visual e de navegação do dashboard**: nova visão geral com métricas do conjunto publicado, navegação rápida, filtros por instituto em painel recolhível, busca na tabela, tela cheia do gráfico, resumo de tendência recente nos cards e navegação móvel persistente. Camada visual isolada para não alterar a metodologia estatística. `index.html`, `src/ui-refresh.js`, `src/ui-refresh.css`, `src/ui-upgrades.js`.
- **Correção do boot nacional após migração tipada**: o front passou a usar o `meta` retornado pelo carregador tipado, importar corretamente `loadMeta`, e normalizar dados com `normalizePolls` durante a atualização automática. Isso corrige a interrupção do boot que deixava cards, tabela e gráfico nacionais sem dados. `src/main.js`.
