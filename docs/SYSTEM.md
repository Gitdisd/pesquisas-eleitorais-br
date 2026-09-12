# Mapa do sistema

Live: https://gitdisd.github.io/pesquisas-eleitorais-br/
Repo: Gitdisd/pesquisas-eleitorais-br · branch `main` · Pages em `gh-pages` via workflow `deploy`.

## Front

| Arquivo | Função |
|---|---|
| `src/main.js` | Boot, merge polls+extra, cartões, tabela, janela |
| `src/chart.js` | Chart.js, pontos + linha do modelo |
| `src/aggregate.js` | Modelos 1–2 + `averageTrend` |
| `src/models-advanced.js` | Modelos 3–4 |
| `src/projection.js` | Tracejado modelo 1 |
| `src/projection-v2.js` | Tracejado modelo 2 + holdout |
| `src/live-overlay.js` | Temas, chips de modelo, layout |
| `src/candidates.js` | Nomes / cores / parse margem |
| `public/data/polls.json` | Base publicada |
| `public/data/polls-extra.json` | Pin manual (ganha no merge pela chave instituto+campo+cenário) |
| `public/data/meta.json` | `last_updated`, hash |

Merge: `pollKey = institute|fieldwork_end|scenario`. Extra substitui a base na mesma chave.

## Pipeline

| Peça | O que faz |
|---|---|
| `scripts/discover-polls.mjs` | Google News RSS + fontes; extrai só página completa; watermark `<` (mesmo dia entra); dedup contra extra |
| `scripts/update-polls.mjs` | Normaliza e grava JSON |
| `.github/workflows/refresh-polls.yml` | Cron `10 */3 * * *` + manual |
| `.github/workflows/deploy-pages.yml` | `npm run build` → artifact → GitHub Pages |
| `Verificar agora` no site | Só recarrega JSON publicado. **Não** dispara Actions |

Backup pré-upgrade discover: `backup/pre-discover-upgrade-2026-09-11`.

## Regras de produto

- Só pesquisas **nacionais** estimuladas no plot principal.
- Não inventar número. Inbox / extra para humano.
- Dedup obrigatório. URL de share é lixo.
- Mudança de fórmula = entrada em `CHANGELOG.md` + ajuste em `MODELS.md`.
