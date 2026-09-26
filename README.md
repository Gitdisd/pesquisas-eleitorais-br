## 2026-09-25 / Rust + Dioxus frontend completed

- The Rust/Dioxus frontend cutover implementation is prepared on this migration branch, using Rust + Dioxus 0.7.10 with a custom SVG chart.
- Apache ECharts is no longer a frontend dependency.
- The remaining JavaScript/TypeScript is limited to offline data/research/reference tooling and parity scripts; it is not shipped as the browser application.
- GitHub Pages cutover remains gated on successful Dioxus build, browser smoke, artifact-content verification, and deployed parity checks.

# Pesquisas Eleitorais BR 2026

Agregador estático de pesquisas **nacionais** para presidente.

Live: https://gitdisd.github.io/pesquisas-eleitorais-br/

## Docs (leia isto antes de mudar código)

**Start here if you are an agent (Grok / ChatGPT):**

- [AGENTS.md](AGENTS.md) — boot rules
- [docs/PEBR-ACQUISITION-CONTEXT.md](docs/PEBR-ACQUISITION-CONTEXT.md) — harvest, RSS, sources, same vs different poll, publish windows
- [docs/PEBR-RESEARCH-REASONING-CODING.md](docs/PEBR-RESEARCH-REASONING-CODING.md) — identity, audits, display layers, coding order

System docs:

- [docs/SYSTEM.md](docs/SYSTEM.md) — o que cada arquivo e workflow faz
- [docs/MODELS.md](docs/MODELS.md) — Modelos 1–7 + escola de centro 8–12
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — o que mudou e quando
- [docs/discovery.md](docs/discovery.md) — busca e staging de pesquisas
- [docs/REPO-CLEANUP-2026-09-22.md](docs/REPO-CLEANUP-2026-09-22.md) — certificação de limpeza e critérios para remover código
- [docs/UI-MIGRATION-2026-09-23.md](docs/UI-MIGRATION-2026-09-23.md) — decisão e registro da migração para Rust/Dioxus + SVG customizado
- [docs/modo-projecao-math.md](docs/modo-projecao-math.md) — math do modo projeção legado

Toda mudança de comportamento leva uma linha no changelog **no mesmo commit**.

## Dev

```
npm install
npm run dev
npm run build
npm run discover-polls
npm run update-polls
npm run poll-pipeline
npm test

# Rust/Dioxus web-ui migration slice
cargo check --manifest-path rust/web-ui/Cargo.toml --target wasm32-unknown-unknown
```

- Production main remains on the restored legacy frontend until the final Rust/Dioxus validation gates pass.
- Front de destino: Rust + Dioxus 0.7.10 + SVG customizado, em `rust/web-ui/`
- Refresh: `.github/workflows/refresh-polls.yml` a cada hora no minuto 10 (`10 * * * *`) + **Run workflow**
- Deploy: `.github/workflows/deploy-pages.yml`; o refresh dispara esse workflow explicitamente depois de publicar um commit de dados
- Discover lê `data/sources.json`, busca sinais/páginas e **estagia** descobertas verificadas em `data/discovery/discovered-polls.json`; não grava diretamente em `data/polls.json`
- TSE recovery mantém registros pendentes/conflictantes fora do gráfico até haver evidência suficiente
- `Verificar agora` no site só recarrega o JSON publicado; não dispara Actions

## Data integrity and reproducibility

Publication dates are preserved as coverage metadata; they are not used to create a new poll identity. The canonical identity is TSE protocol + scenario + geography when available, with normalized institute + fieldwork dates + scenario + geography as fallback. The browser exposes a shared `window.__pebr` data store, and shared links preserve the selected round, range, averaging window, institutes, and model.

Unverified TSE registrations remain in a pending audit queue and are excluded from the chart. National and state-president registrations are classified separately. Multi-geo regional views do not display a blended aggregate mean.

Sample-size influence is capped at N=4,000 before square-root weighting. The chart's aggregate uncertainty ribbon is an estimated 90% range from the poll set; it is not an individual survey MOE and not an election forecast.

## Refresh / maintenance

The scheduled refresh performs discovery, document recovery, TSE registry recovery, supplemental merge, deterministic audits, quality-gate validation, and a production build. If data changes, it commits the canonical/public data and explicitly dispatches the Pages deployment.

The deep-repair workflow is **manual-only** and read-only. It validates, typechecks, tests, and builds; it does not push changes or open PRs.
