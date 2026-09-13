# Modelos da linha (não são prognóstico de urna)

Pontos no gráfico = pesquisas brutas, data = **fim de campo**.
Linha sólida = média do chip ativo. Cartões usam a mesma função.
**Padrão do site = Modelo 1.**
Nenhum modelo publica P(vitória) nem inventa pesquisa.

Código: `src/aggregate.js` (1 e 2), `src/models-advanced.js` (3, 4 e 5).
Overlays visuais: `src/overlays.js` — não alteram a média.
Dispatch: `averageTrend(points, windowDays, model)`.

## Entrada comum

Cada ponto: `{ t, y, n, institute, moe? }`.
`windowDays` = chip da janela (padrão 14).

## off

Pontos + linha do Modelo 1. Sem tracejado de projeção.

## Modelo 1 — média antiga (padrão)

`peso = √(n/2000) × exp(−dias/janela)`

- n ausente → 800; n limitado a 100–8000.
- Só desenha o dia se existir pesquisa a ≤ janela dias.

## Modelo 2 — meia-vida + house

`peso = √(n/2000) × 2^(−dias/meiaVida) × 1/k_instituto`

## Modelo 3 — meta-análise de efeitos aleatórios

`peso = recência / (σ_i² + τ²) / k_instituto`
σ via margem/1,96 ou deff 1,3 × √[p(1-p)/n]. τ² = DerSimonian–Laird.

## Modelo 4 — intenção latente (Kalman + RTS)

θ_t = θ_{t-1} + ruído (~0,16 pp/√day). Casa + erro amostral na observação.

## Modelo 5 — reativo

Meia-vida = max(2, janela/5).
`peso = √(n/2000) × 2^(-d/half) × (1 + 2 e^(-d/1,8))`
Sem house. Reage rápido a pesquisa nova.

## Overlays (não são modelo)

Cada chip liga/desliga sozinho. Calculados em cima da linha do modelo ativo:
SMA 7 / 21, EMA 9 / 21, HMA 16, VWMA 14 (peso = n da pesquisa), KAMA 10, Bollinger 20 ± 2σ.

## O que isto não é

- Não é MRP estadual.
- Não corrige erro de 2022.
- Não simula 2º turno.
- Overlay de pregão não é estatística eleitoral; é régua visual.
