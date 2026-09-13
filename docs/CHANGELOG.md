# Changelog

Registro de mudanças reais. Entrada nova no topo. Não reescrever história.

Formato: data (America/Sao_Paulo) · o quê · por que · arquivos.

## 2026-09-13

- **Metodologia ao vivo** em seções: objetivo, viés de casa, modelos 1–5, overlays, o que não é. `src/methodology.js`.

- **Padrão = Modelo 1** (fórmula original √n × e^(-−d/janela)). Chip grava `pebr-model` no localStorage.
- **Modelo 5 reativo.** Meia-vida = max(2, janela/5) e impulso 1+2e^(-d/1,8) nas pesquisas novas. Sem house. `src/models-advanced.js`.
- **Overlays independentes** (não entram na média): SMA7, SMA21, EMA9, EMA21, HMA16, VWMA14 (n = volume), KAMA10, Bollinger 20±2σ. Chips em Overlay. `src/overlays.js` + `src/chart.js`.
- **Nexus/BTG 4–7 set** pinado em `polls-extra.json` (1º 39–35–9; 2º Flávio 46 × Lula 45). Quaest 10–13 set ainda não publicada (divulgação 14/set).

## 2026-09-12

- **Docs permanentes.** `docs/CHANGELOG.md`, `docs/MODELS.md`, `docs/SYSTEM.md`.
- **Modelo 3 e 4 no plot.** 3 = RE-meta. 4 = Kalman + smoother.
- **Modelo 1 vs 2 separados.**

## 2026-09-11

- **Média default 14d.** Delta vs 30d.
- Discover watermark `<`, extra dedup, Datafolha 8–10 set.
- Temas CRT e bandeira.

## Regras para a próxima mudança

1. Acrescentar uma linha neste arquivo **no mesmo commit** da mudança.
2. Se a fórmula da linha mudar, atualizar `docs/MODELS.md`.
3. Se o pipeline mudar, atualizar `docs/SYSTEM.md`.
4. Não apagar entradas. Corrigir com uma entrada “correção”.
