# Mapa do sistema

Live: https://gitdisd.github.io/pesquisas-eleitorais-br/  
Repo: gitdisd/pesquisas-eleitorais-br · branch `main` · Pages via workflow `deploy-pages.yml`.

## Front

| Arquivo | Função |
|---|---|
| `src/main.js` | Boot, national data store, cards, table, controls, automatic refresh |
| `src/chart.js` | ECharts renderer, poll points, aggregate line, uncertainty ribbon, pan/zoom |
| `src/aggregate.ts` | Aggregate models 1–2 + `averageTrend` |
| `src/models/advanced.ts` | Models 3–7 |
| `src/candidates.js` | Shared candidate registry / names / normalization |
| `src/data/identity.js` | Canonical poll identity, TSE protocol, geography and fallback keys |
| `src/data/normalize.ts` | Raw → normalized poll records and merge identity |
| `src/regional-panel.js` | State/president-in-state panel and multi-geo isolation |
| `src/ui-refresh.js` | Dashboard refresh layer; consumes the shared national store |
| `src/ui-next.js` | Share URLs and filtered CSV/JSON export |
| `public/data/polls.json` | Published canonical national base |
| `public/data/polls-extra.json` | Manual/supplemental values |
| `public/data/meta.json` | Publication clocks, count, hash and successful-pipeline timestamp |

The browser uses `window.__pebr` as the shared national snapshot. UI modules do not independently refetch the national JSON.

## Data identity

Canonical identity is:

1. `tse_protocol + scenario + geography` when the TSE protocol is known;
2. otherwise normalized `institute + fieldwork_start + fieldwork_end + scenario + geography`.

`published_date` is retained and displayed as coverage metadata. It is **never** part of poll identity.

Witness URLs and coverage dates are accumulated rather than creating duplicate poll rows. A later TSE registration can re-key a fallback record to the canonical TSE identity.

## Pipeline

| Peça | O que faz |
|---|---|
| `scripts/discover-polls.mjs` | Searches configured sources, extracts complete HTML pages, and stages verified discoveries; incomplete/PDF evidence goes to inbox |
| `scripts/merge-poll-supplements.mjs` | Reconciles canonical polls, staged discoveries and witnesses |
| `scripts/poll-pipeline.mjs` / `scripts/run-poll-pipeline-v4.mjs` | TSE registry recovery and classification |
| `scripts/update-polls.mjs` | Normalizes/publishes canonical JSON and metadata |
| `scripts/quality-gate.mjs` | Publication/data contract checks |
| `scripts/quality-audit.mjs` | Deterministic identity/integrity audit |
| `.github/workflows/refresh-polls.yml` | Hourly refresh at minute 10 + manual dispatch |
| `.github/workflows/deploy-pages.yml` | Builds, validates, uploads artifact, and deploys GitHub Pages |
| `.github/workflows/deep-repair.yml` | Manual read-only validation/build maintenance |
| `Verificar agora` | Reloads published JSON only; does **not** run Actions |

After a successful refresh that changes data, `refresh-polls.yml` explicitly dispatches `deploy-pages.yml`. This is required because the refresh push uses `GITHUB_TOKEN`.

## Discovery / audit state

- `data/discovery/discovered-polls.json`: verified discoveries staged for canonical merge.
- `data/discovery/witnesses.json`: append-oriented witness evidence.
- `data/discovery/inbox.json`: incomplete/ambiguous evidence requiring review.
- `data/discovery/pending-polls.json`: unresolved TSE registrations; not chart-visible.
- `data/discovery/registry-queues.json`: national-president, state-president and other-office registry classification.
- `data/discovery/last-run.json` and related audit files: machine-readable pipeline status.

## Product / integrity rules

- Main chart reads **national** presidential data only.
- Do not invent percentages or fill missing values without evidence.
- Publication date remains visible in the table and metadata.
- Deduplication is mandatory.
- Sample-size influence is capped at N=4,000 before square-root weighting.
- Aggregate uncertainty is an estimated 90% range, not a survey MOE or election forecast.
- Multi-geo regional views do not display a blended mean.
- Existing TradingView-style pan/zoom/pinch/resize behavior must survive data refresh; ECharts is updated in place rather than destroying/recreating it.
- Share URLs preserve round/range/window/model/institute filters.
- JSON/CSV exports reflect the current filtered view.

## Backward-compatibility / maintenance

The old v3 poll runner and self-modifying parser behavior were removed. The TSE resolver receives temporary registry bytes through environment/configuration at runtime rather than rewriting parser source files.

Changes to formulas require `docs/MODELS.md` + `docs/CHANGELOG.md`. Pipeline behavior changes require this file + `docs/CHANGELOG.md`.
