# Changelog

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
