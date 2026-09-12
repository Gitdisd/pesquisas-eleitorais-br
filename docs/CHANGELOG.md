# Changelog

Registro de mudanças reais. Entrada nova no topo. Não reescrever história.

Formato: data (America/Sao_Paulo) · o quê · por que · arquivos.

## 2026-09-12

- **Docs permanentes.** `docs/CHANGELOG.md`, `docs/MODELS.md`, `docs/SYSTEM.md`. Motivo: o site precisa ser auditável e as sessões futuras do Grok precisam saber o que já existe.
- **Modelo 3 e 4 no plot.** Média sólida muda com o chip. 3 = meta-análise de efeitos aleatórios (N + margem + τ²). 4 = Kalman + smoother da intenção latente. Não são P(vitória). Arquivos: `src/models-advanced.js`, `src/aggregate.js`, `src/chart.js`, `src/main.js`, `src/live-overlay.js`.
- **Modelo 1 vs 2 separados.** Chip 1 = fórmula antiga √n × e^(-−d/janela). Chip 2 = meia-vida + anti-inundação + house ±14d. Cartões seguem o mesmo chip.

## 2026-09-11

- **Média default 14d.** Chip 14d ligado por padrão. Delta dos cartões passou de “vs mai/2026” para “vs 30d”.
- **Discover mais confiável.** Watermark estrito `<` (mesmo dia entra). Dedup carrega `polls-extra.json`. Ranking de URLs. Palver/Veritá nos padrões. Backup: branch `backup/pre-discover-upgrade-2026-09-11`.
- **Datafolha 8–10 set** pinado em `public/data/polls-extra.json` + `data/sources.json`.
- Temas CRT âmbar/verde e temas de bandeira (PT, PL, Missão, PSD, Novo, Avante). Tooltip fora do canvas. Tabela sticky.

## Regras para a próxima mudança

1. Acrescentar uma linha neste arquivo **no mesmo commit** da mudança.
2. Se a fórmula da linha mudar, atualizar `docs/MODELS.md`.
3. Se o pipeline (discover, cron, extra.json) mudar, atualizar `docs/SYSTEM.md`.
4. Não apagar entradas. Corrigir com uma entrada “correção”.
