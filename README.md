# Pesquisas Eleitorais BR 2026

Agregador estático de pesquisas **nacionais** para presidente.

Live: https://gitdisd.github.io/pesquisas-eleitorais-br/

## Docs (leia isto antes de mudar código)

- [docs/SYSTEM.md](docs/SYSTEM.md) — o que cada arquivo e workflow faz
- [docs/MODELS.md](docs/MODELS.md) — Modelos 1–4 (o que a linha é e o que não é)
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — o que mudou e quando
- [docs/discovery.md](docs/discovery.md) — busca de pesquisas
- [docs/modo-projecao-math.md](docs/modo-projecao-math.md) — math do tracejado antigo

Toda mudança de comportamento leva uma linha no changelog **no mesmo commit**.

## Dev

```
npm install
npm run dev
npm run build
npm run discover-polls
npm run update-polls
```

- Front: Vite, base `/pesquisas-eleitorais-br/`, `outDir dist`
- Cron: `.github/workflows/refresh-polls.yml` a cada 3 h (`10 */3 * * *`) + **Run workflow**
- Discover relê `data/sources.json`, extrai HTML, rejeita estadual e PDF (inbox)
- `Verificar agora` no site só recarrega o JSON publicado; não dispara Actions
