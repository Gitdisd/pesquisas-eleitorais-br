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
| `src/main.js` | boot, data store, cards/table, controls, refresh | Dioxus app/state | not migrated |
| `src/chart.js` | chart rendering, points, aggregate, uncertainty, navigation | custom Rust/SVG | first slice exists |
| `src/aggregate.js` | TS aggregate compatibility re-export | Rust aggregate | protected |
| `src/aggregate.ts` | weighted trends, uncertainty, model dispatch | Rust statistics | weightedTrendV1/weightedTrendV2/uncertainty/model-2 primitives moved to shared Rust core; model dispatch remains |
| `src/projection.js` | projection UI/math | Rust projection + Dioxus | base projection math migrated to Rust; UI/copy integration remains |
| `src/projection-v2.js` | projection-v2 | Rust projection + Dioxus | shared Rust process-noise selection, holdout gate and projection-v2 core migrated; production caller/UI remains |
| `src/candidates.js` | candidate registry/aliases/scenario parsing | Rust canonical data layer | partial |
| `src/data/api.ts` | JSON loading | Rust data client | first slice exists |
| `src/data/identity.js` | canonical identity/TSE/geo keys | Rust identity | protocol-note recovery and identity description migrated; production JS caller remains |
| `src/data/normalize.ts` | raw→normalized/merge | Rust normalization | partial |
| `src/data/types.ts` | TypeScript contracts | Rust structs/contracts | partial |
| `src/models/advanced.ts` | models 3–7 | Rust statistical models | not migrated |
| `src/models/school.ts` | models 8–12 | Rust statistical models | not migrated |
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
| `src/methodology.js` | methodology/diagnostic UI | Dioxus components | not migrated |
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
5. Custom SVG crosshair, pan, pinch, wheel zoom and range navigation.
6. Regional/methodology/diagnostic surfaces.
7. Share/export/theme/accessibility/performance parity.
8. Production build and Pages cutover.
9. Repository-wide browser JS/TS execution-graph certification.
10. Remove Vite/ECharts/legacy browser modules only after deployed replacement verification.

## Current status

Production is unchanged. Apache ECharts is not part of the target architecture. PR #40 contains the parallel Rust/Dioxus replacement.

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
- No existing JS/TS production module is certified removable.
- Canonical `weightedTrendV1` now has a shared Rust implementation and the Rust/Dioxus chart delegates to it.
- The latest compile failure is limited to migration-schema dead-code warnings and the Dioxus component naming lint; no runtime/data-path failure was reached. The old JS/TS implementation remains protected until numerical parity and production cutover gates pass.
- No production cutover or live-site behavior change has occurred.

The validation record is intentionally kept chronological so failures and corrections remain auditable rather than being rewritten away.
