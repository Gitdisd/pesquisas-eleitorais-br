# Pesquisas Eleitorais BR 2026

Agregador estático de pesquisas **nacionais** para presidente.

```
npm install
npm run dev
npm run build
npm run discover-polls
npm run update-polls
```

- Front: Vite, base `/pesquisas-eleitorais-br/`, `outDir dist`
- Cron: `.github/workflows/refresh-polls.yml` every 3 hours (`10 */3 * * *`) + manual **Run workflow**
- Discover revisits `data/sources.json`, extracts HTML, rejects state-only stories and PDFs (inbox)
- `Verificar agora` on the site only reloads the published JSON; it does not start Actions

Live: https://gitdisd.github.io/pesquisas-eleitorais-br/
