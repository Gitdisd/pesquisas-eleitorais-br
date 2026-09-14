# Changelog

Registro de mudanças reais. Entrada nova no topo. Não reescrever história.

Formato: data (America/Sao_Paulo) · o quê · por que · arquivos.

## 2026-09-14

- **Refresh visual e de navegação do dashboard**: nova visão geral com métricas do conjunto publicado, navegação rápida, filtros por instituto em painel recolhível, busca na tabela, tela cheia do gráfico, resumo de tendência recente nos cards e navegação móvel persistente. Camada visual isolada para não alterar a metodologia estatística. `index.html`, `src/ui-refresh.js`, `src/ui-refresh.css`, `src/ui-upgrades.js`.
- **Correção do boot nacional após migração tipada**: o front passou a usar o `meta` retornado pelo carregador tipado, importar corretamente `loadMeta`, e normalizar dados com `normalizePolls` durante a atualização automática. Isso corrige a interrupção do boot que deixava cards, tabela e gráfico nacionais sem dados. `src/main.js`.

## 2026-09-13

- **Metodologia em linguagem simples**, com exemplo em cada bloco: modelos, overlays, eixos/zoom, chips. Fórmulas ficam num `<details>`. `src/methodology.js`.
- **Metodologia ao vivo** em seções.
- **Padrão = Modelo 1**. Chip grava `pebr-model`.
- **Modelo 5 reativo.**
- **Overlays independentes** (SMA, EMA, HMA, VWMA, KAMA, BB).
- **Nexus/BTG 4–7 set** no extra. Quaest 14/set ainda não saiu.

## 2026-09-12

- Docs permanentes. Modelos 3 e 4. Modelo 1 vs 2.

## 2026-09-11

- Média default 14d. Discover + Datafolha 8–10 set. Temas CRT.

## Regras para a próxima mudança

1. Acrescentar uma linha neste arquivo **no mesmo commit** da mudança.
2. Se a fórmula da linha mudar, atualizar `docs/MODELS.md`.
3. Se o pipeline mudar, atualizar `docs/SYSTEM.md`.
4. Não apagar entradas. Corrigir com uma entrada “correção”.
