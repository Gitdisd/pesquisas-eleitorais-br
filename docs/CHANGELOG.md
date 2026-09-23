# Changelog

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
